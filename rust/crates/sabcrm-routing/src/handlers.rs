//! HTTP handlers for the SabCRM assignment-routing domain.
//!
//! Lifecycle over the `sabcrm_routing_rules` Mongo collection, plus the
//! `POST /evaluate` application path that writes assignments onto
//! `sabcrm_records`.
//!
//! | Endpoint                            | TS action                 |
//! |-------------------------------------|---------------------------|
//! | `GET    /v1/sabcrm/routing`         | `listSabcrmRoutingRules`  |
//! | `POST   /v1/sabcrm/routing`         | `createSabcrmRoutingRule` |
//! | `POST   /v1/sabcrm/routing/evaluate`| `evaluateSabcrmRouting`   |
//! | `GET    /v1/sabcrm/routing/{id}`    | `getSabcrmRoutingRule`    |
//! | `PATCH  /v1/sabcrm/routing/{id}`    | `updateSabcrmRoutingRule` |
//! | `DELETE /v1/sabcrm/routing/{id}`    | `deleteSabcrmRoutingRule` |
//!
//! ## Condition evaluation
//!
//! [`eval_condition`] mirrors the workflow runtime's `evalCondition`
//! (`src/lib/sabcrm/runtime.ts`): loose string equality for `eq` / `ne` /
//! membership, substring for `contains`, numeric coercion for the ordered
//! operators, and **unknown operators never match** (fail closed). Conditions
//! on a rule are ANDed; an empty list matches everything.
//!
//! ## Round-robin atomicity
//!
//! The rotation cursor is `lastAssignedIndex`. Applying a round-robin rule
//! does `find_one_and_update({_id, projectId}, {$inc: {lastAssignedIndex: 1}})`
//! returning the AFTER document — Mongo serialises the increments, so two
//! concurrent evaluations get distinct cursor values and therefore distinct
//! assignees (`pick_round_robin`).
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus `_id`
//! as appropriate) — **not** `userId`. Every handler requires the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateRuleInput, EvaluateInput, EvaluateResponse, ListQuery, ListResponse, OkResponse,
    RuleCondition, RuleResponse, RuleStrategy, RuleTrigger, ScopeQuery, UpdateRuleInput,
    default_assign_field,
};

/// The Mongo collection backing routing rules.
const RULES_COLL: &str = "sabcrm_routing_rules";

/// The Mongo collection backing CRM records (assignment target).
const RECORDS_COLL: &str = "sabcrm_records";

/// Hard cap on rules considered per evaluation (defensive; rules are few).
const MAX_RULES_PER_EVALUATION: i64 = 100;

// ===========================================================================
// helpers
// ===========================================================================

/// Reject an empty `projectId` early — every filter leads with it.
fn require_project(project_id: &str) -> Result<&str> {
    let p = project_id.trim();
    if p.is_empty() {
        return Err(ApiError::Validation("projectId is required.".to_owned()));
    }
    Ok(p)
}

/// Reject an empty required string field, naming it in the error.
fn require_str<'a>(value: &'a str, name: &str) -> Result<&'a str> {
    let v = value.trim();
    if v.is_empty() {
        return Err(ApiError::Validation(format!("{name} is required.")));
    }
    Ok(v)
}

/// Trim an optional string to `None` when blank.
fn opt_str(value: &Option<String>) -> Option<&str> {
    value.as_deref().map(str::trim).filter(|s| !s.is_empty())
}

/// Clean a stored document into the wire JSON, renaming `_id` → `id` (hex).
fn record_to_wire(doc: Document) -> Value {
    let mut json = document_to_clean_json(doc);
    if let Value::Object(map) = &mut json {
        if let Some(id) = map.remove("_id") {
            map.insert("id".to_owned(), id);
        }
    }
    json
}

/// Convert an incoming flattened JSON object into a BSON `Document`,
/// dropping `_id` / `projectId` / `lastAssignedIndex` so callers cannot
/// rewrite tenancy keys or skew the rotation cursor.
fn payload_to_set(value: &Value) -> Result<Document> {
    let bson = bson::to_bson(value).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_routing.payload.to_bson"))
    })?;
    let doc = match bson {
        Bson::Document(d) => d,
        _ => return Err(ApiError::Validation("body must be an object.".to_owned())),
    };
    let mut out = Document::new();
    for (k, v) in doc {
        if matches!(k.as_str(), "_id" | "projectId" | "lastAssignedIndex") {
            continue;
        }
        out.insert(k, v);
    }
    Ok(out)
}

/// Serialize a typed value into BSON for storage.
fn to_bson_ctx<T: serde::Serialize>(value: &T, ctx: &'static str) -> Result<Bson> {
    bson::to_bson(value).map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(ctx)))
}

/// Map a Mongo error into an internal `ApiError` with collection context.
fn db_err(e: mongodb::error::Error, ctx: &'static str) -> ApiError {
    ApiError::Internal(anyhow::Error::new(e).context(ctx))
}

/// Validate the assignee roster: non-empty, no blank entries.
fn validate_assignees(assignees: &[String]) -> Result<()> {
    if assignees.is_empty() {
        return Err(ApiError::Validation("assignees must be non-empty.".to_owned()));
    }
    if assignees.iter().any(|a| a.trim().is_empty()) {
        return Err(ApiError::Validation("assignees must not contain blanks.".to_owned()));
    }
    Ok(())
}

/// The wire slug of a trigger (`record.created` / `form.submission`).
fn trigger_slug(trigger: &RuleTrigger) -> &'static str {
    match trigger {
        RuleTrigger::RecordCreated => "record.created",
        RuleTrigger::FormSubmission => "form.submission",
    }
}

// ===========================================================================
// Condition evaluation (workflow operator vocabulary, fail closed)
// ===========================================================================

/// Walk a dotted path (`a.b.c`) into a JSON value; `None` when absent.
fn get_path<'a>(root: &'a Value, path: &str) -> Option<&'a Value> {
    let mut cur = root;
    for part in path.split('.').map(str::trim).filter(|p| !p.is_empty()) {
        cur = cur.as_object()?.get(part)?;
    }
    Some(cur)
}

/// Render a JSON value the way the workflow runtime's loose equality does:
/// scalars via display, `null`/missing as the empty string.
fn loose_string(v: Option<&Value>) -> String {
    match v {
        None | Some(Value::Null) => String::new(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Number(n)) => n.to_string(),
        Some(other) => other.to_string(),
    }
}

/// Loose equality (`a == b` after stringification) — mirrors the TS
/// `looseEq` so `"5"` matches `5` and ids match their stringified forms.
fn loose_eq(left: Option<&Value>, right: Option<&Value>) -> bool {
    loose_string(left) == loose_string(right)
}

/// Coerce the RHS of a membership operator into a list (CSV strings split),
/// mirroring the TS `toArray`.
fn to_array(v: Option<&Value>) -> Vec<Value> {
    match v {
        None | Some(Value::Null) => Vec::new(),
        Some(Value::Array(items)) => items.clone(),
        Some(Value::String(s)) => s
            .split(',')
            .map(str::trim)
            .filter(|p| !p.is_empty())
            .map(|p| Value::String(p.to_owned()))
            .collect(),
        Some(other) => vec![other.clone()],
    }
}

/// Coerce a JSON value to a float for the ordered operators (`NaN` → `None`).
fn to_num(v: Option<&Value>) -> Option<f64> {
    match v {
        Some(Value::Number(n)) => n.as_f64(),
        Some(Value::String(s)) if !s.trim().is_empty() => s.trim().parse().ok(),
        _ => None,
    }
}

/// Is a value "empty" (`null` / missing / blank string / empty array)?
fn is_empty_value(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => true,
        Some(Value::String(s)) => s.trim().is_empty(),
        Some(Value::Array(items)) => items.is_empty(),
        _ => false,
    }
}

/// Evaluate one `{ field, operator, value }` condition against a record's
/// `data` map. The operator vocabulary mirrors the workflow runtime
/// (`evalCondition` in `src/lib/sabcrm/runtime.ts`); **unknown operators
/// never match** so a typo'd rule fails closed instead of stealing records.
fn eval_condition(cond: &RuleCondition, data: &Value) -> bool {
    let left = get_path(data, &cond.field);
    let right = cond.value.as_ref();
    match cond.operator.as_str() {
        "eq" | "==" | "equals" | "field_equals" => loose_eq(left, right),
        "ne" | "!=" | "notEquals" => !loose_eq(left, right),
        "in" | "field_in" => to_array(right).iter().any(|v| loose_eq(left, Some(v))),
        "notIn" | "nin" => !to_array(right).iter().any(|v| loose_eq(left, Some(v))),
        "contains" => loose_string(left).contains(&loose_string(right)),
        "notContains" => !loose_string(left).contains(&loose_string(right)),
        "gt" => matches!((to_num(left), to_num(right)), (Some(l), Some(r)) if l > r),
        "gte" => matches!((to_num(left), to_num(right)), (Some(l), Some(r)) if l >= r),
        "lt" => matches!((to_num(left), to_num(right)), (Some(l), Some(r)) if l < r),
        "lte" => matches!((to_num(left), to_num(right)), (Some(l), Some(r)) if l <= r),
        "isEmpty" => is_empty_value(left),
        "isNotEmpty" => !is_empty_value(left),
        _ => false,
    }
}

/// Do ALL conditions accept this record `data`? (Empty list → match.)
fn conditions_match(conditions: &[RuleCondition], data: &Value) -> bool {
    conditions.iter().all(|c| eval_condition(c, data))
}

// ===========================================================================
// Strategy helpers
// ===========================================================================

/// Pick the round-robin assignee for the POST-`$inc` cursor value.
///
/// `incremented` is `lastAssignedIndex` AFTER the atomic `$inc` (so the first
/// ever evaluation sees `1`). The pick is `(incremented - 1) mod len`, which
/// starts rotation at `assignees[0]` and walks forward one per evaluation —
/// see the unit tests for the exact sequence.
fn pick_round_robin(assignees: &[String], incremented: i64) -> Option<&String> {
    if assignees.is_empty() {
        return None;
    }
    let len = assignees.len() as i64;
    let idx = (incremented - 1).rem_euclid(len) as usize;
    assignees.get(idx)
}

// ===========================================================================
// GET / — listSabcrmRoutingRules
// ===========================================================================

/// `GET /v1/sabcrm/routing` — list the project's rules in priority order
/// (`position` asc, then `createdAt` asc), optionally narrowed by
/// `objectSlug` / `trigger` / `active`.
#[instrument(skip_all)]
pub async fn list_rules(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let mut filter = doc! { "projectId": project_id };
    if let Some(object_slug) = opt_str(&query.object_slug) {
        filter.insert("objectSlug", object_slug);
    }
    if let Some(trigger) = opt_str(&query.trigger) {
        serde_json::from_value::<RuleTrigger>(Value::String(trigger.to_owned())).map_err(
            |_| {
                ApiError::Validation(
                    "trigger must be record.created or form.submission.".to_owned(),
                )
            },
        )?;
        filter.insert("trigger", trigger);
    }
    if let Some(active) = query.active {
        filter.insert("active", active);
    }

    let mut cursor = mongo
        .collection::<Document>(RULES_COLL)
        .find(filter)
        .sort(doc! { "position": 1, "createdAt": 1 })
        .await
        .map_err(|e| db_err(e, "sabcrm_routing_rules.find"))?;

    let mut rules = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| db_err(e, "sabcrm_routing_rules.cursor"))?
    {
        rules.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { rules }))
}

// ===========================================================================
// POST / — createSabcrmRoutingRule
// ===========================================================================

/// `POST /v1/sabcrm/routing` — create a routing rule. Defaults: trigger
/// `record.created`, strategy `round_robin`, assignField `owner`, active
/// `true`, position `0`, conditions `[]`, lastAssignedIndex `0`.
#[instrument(skip_all)]
pub async fn create_rule(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateRuleInput>,
) -> Result<Json<RuleResponse>> {
    let project_id = require_project(&body.project_id)?;
    let name = require_str(&body.name, "name")?;
    let object_slug = require_str(&body.object_slug, "objectSlug")?;
    validate_assignees(&body.assignees)?;

    let trigger = body.trigger.unwrap_or(RuleTrigger::RecordCreated);
    let strategy = body.strategy.unwrap_or(RuleStrategy::RoundRobin);
    let conditions = body.conditions.unwrap_or_default();
    let assign_field = body
        .assign_field
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(default_assign_field);

    let now = Utc::now().to_rfc3339();
    let new_doc = doc! {
        "_id": ObjectId::new(),
        "projectId": project_id,
        "name": name,
        "objectSlug": object_slug,
        "trigger": trigger_slug(&trigger),
        "conditions": to_bson_ctx(&conditions, "sabcrm_routing_rules.conditions.to_bson")?,
        "strategy": to_bson_ctx(&strategy, "sabcrm_routing_rules.strategy.to_bson")?,
        "assignees": body.assignees.iter().map(|s| s.trim()).collect::<Vec<_>>(),
        "assignField": &assign_field,
        "active": body.active,
        "position": body.position.unwrap_or(0),
        "lastAssignedIndex": 0_i64,
        "createdAt": &now,
        "updatedAt": &now,
    };

    mongo
        .collection::<Document>(RULES_COLL)
        .insert_one(&new_doc)
        .await
        .map_err(|e| db_err(e, "sabcrm_routing_rules.insert_one"))?;

    Ok(Json(RuleResponse {
        rule: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// GET /{id} — getSabcrmRoutingRule
// ===========================================================================

/// `GET /v1/sabcrm/routing/{id}` — fetch one rule scoped by project.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_rule(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<RuleResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let found = mongo
        .collection::<Document>(RULES_COLL)
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| db_err(e, "sabcrm_routing_rules.find_one"))?
        .ok_or_else(|| ApiError::NotFound("routing rule".to_owned()))?;

    Ok(Json(RuleResponse {
        rule: record_to_wire(found),
    }))
}

// ===========================================================================
// PATCH /{id} — updateSabcrmRoutingRule
// ===========================================================================

/// `PATCH /v1/sabcrm/routing/{id}` — partial update. Typed fields
/// (`trigger` / `strategy` / `conditions` / `assignees`) are validated when
/// present; remaining keys are `$set` verbatim, `updatedAt` is always bumped,
/// and `lastAssignedIndex` is never writable through this surface.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_rule(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateRuleInput>,
) -> Result<Json<RuleResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    if let Some(t) = body.patch.get("trigger") {
        serde_json::from_value::<RuleTrigger>(t.clone()).map_err(|_| {
            ApiError::Validation("trigger must be record.created or form.submission.".to_owned())
        })?;
    }
    if let Some(s) = body.patch.get("strategy") {
        serde_json::from_value::<RuleStrategy>(s.clone()).map_err(|_| {
            ApiError::Validation(
                "strategy must be round_robin / least_assigned / fixed.".to_owned(),
            )
        })?;
    }
    if let Some(c) = body.patch.get("conditions") {
        serde_json::from_value::<Vec<RuleCondition>>(c.clone()).map_err(|e| {
            ApiError::Validation(format!(
                "conditions must be a list of {{ field, operator, value? }}: {e}"
            ))
        })?;
    }
    if let Some(a) = body.patch.get("assignees") {
        let assignees: Vec<String> = serde_json::from_value(a.clone()).map_err(|_| {
            ApiError::Validation("assignees must be a list of member ids.".to_owned())
        })?;
        validate_assignees(&assignees)?;
    }

    let now = Utc::now().to_rfc3339();
    let mut set = payload_to_set(&body.patch)?;
    set.insert("updatedAt", &now);

    let updated = mongo
        .collection::<Document>(RULES_COLL)
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| db_err(e, "sabcrm_routing_rules.find_one_and_update"))?
        .ok_or_else(|| ApiError::NotFound("routing rule".to_owned()))?;

    Ok(Json(RuleResponse {
        rule: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — deleteSabcrmRoutingRule
// ===========================================================================

/// `DELETE /v1/sabcrm/routing/{id}` — scoped delete.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_rule(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let deleted = mongo
        .collection::<Document>(RULES_COLL)
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| db_err(e, "sabcrm_routing_rules.delete_one"))?;
    if deleted.deleted_count == 0 {
        return Err(ApiError::NotFound("routing rule".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// POST /evaluate — evaluateSabcrmRouting
// ===========================================================================

/// One rule, deserialized loosely off its stored document for evaluation.
struct LoadedRule {
    oid: ObjectId,
    name: String,
    conditions: Vec<RuleCondition>,
    strategy: RuleStrategy,
    assignees: Vec<String>,
    assign_field: String,
}

/// Parse a stored rule document into a [`LoadedRule`]. Malformed documents
/// (hand-edited / legacy) return `None` and are skipped rather than failing
/// the whole evaluation.
fn load_rule(doc: &Document) -> Option<LoadedRule> {
    let oid = doc.get_object_id("_id").ok()?;
    let json = document_to_clean_json(doc.clone());
    let conditions: Vec<RuleCondition> = json
        .get("conditions")
        .cloned()
        .map(serde_json::from_value)
        .transpose()
        .ok()?
        .unwrap_or_default();
    let strategy: RuleStrategy = json
        .get("strategy")
        .cloned()
        .map(serde_json::from_value)
        .transpose()
        .ok()?
        .unwrap_or(RuleStrategy::RoundRobin);
    let assignees: Vec<String> = json
        .get("assignees")
        .cloned()
        .map(serde_json::from_value)
        .transpose()
        .ok()?
        .unwrap_or_default();
    if assignees.is_empty() {
        return None;
    }
    let assign_field = json
        .get("assignField")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(default_assign_field);
    let name = json
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();
    Some(LoadedRule {
        oid,
        name,
        conditions,
        strategy,
        assignees,
        assign_field,
    })
}

/// `POST /v1/sabcrm/routing/evaluate` — apply the FIRST matching active rule
/// for `(objectSlug, trigger)` to one record:
///
/// 1. load the record (`404` when absent / trashed) and its `data` map;
/// 2. walk the active rules in `position` order, skipping rules whose
///    conditions reject the data;
/// 3. pick an assignee per the matched rule's strategy — `round_robin`
///    persists its rotation atomically via `$inc lastAssignedIndex`,
///    `least_assigned` counts current holders of `data.<assignField>` on this
///    object, `fixed` takes the first roster entry;
/// 4. `$set` the record's `data.<assignField>` (and bump `updatedAt`).
///
/// Returns `{ matched: false }` when no rule accepts the record.
#[instrument(skip_all)]
pub async fn evaluate(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<EvaluateInput>,
) -> Result<Json<EvaluateResponse>> {
    let project_id = require_project(&body.project_id)?;
    let object_slug = require_str(&body.object_slug, "objectSlug")?;
    let record_id = require_str(&body.record_id, "recordId")?;
    let record_oid = oid_from_str(record_id)?;
    let trigger = body.trigger.unwrap_or(RuleTrigger::RecordCreated);

    // --- 1. the record ------------------------------------------------------
    let records = mongo.collection::<Document>(RECORDS_COLL);
    let record = records
        .find_one(doc! {
            "projectId": project_id,
            "object": object_slug,
            "_id": record_oid,
            "deletedAt": Bson::Null,
        })
        .await
        .map_err(|e| db_err(e, "sabcrm_records.evaluate.find_one"))?
        .ok_or_else(|| ApiError::NotFound("record".to_owned()))?;
    let data = document_to_clean_json(record)
        .get("data")
        .cloned()
        .unwrap_or_else(|| Value::Object(Default::default()));

    // --- 2. the rules, priority order ----------------------------------------
    let rules_coll = mongo.collection::<Document>(RULES_COLL);
    let mut cursor = rules_coll
        .find(doc! {
            "projectId": project_id,
            "objectSlug": object_slug,
            "trigger": trigger_slug(&trigger),
            "active": true,
        })
        .sort(doc! { "position": 1, "createdAt": 1 })
        .limit(MAX_RULES_PER_EVALUATION)
        .await
        .map_err(|e| db_err(e, "sabcrm_routing_rules.evaluate.find"))?;

    let mut matched: Option<LoadedRule> = None;
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| db_err(e, "sabcrm_routing_rules.evaluate.cursor"))?
    {
        let Some(rule) = load_rule(&d) else { continue };
        if conditions_match(&rule.conditions, &data) {
            matched = Some(rule);
            break;
        }
    }

    let Some(rule) = matched else {
        return Ok(Json(EvaluateResponse {
            matched: false,
            rule_id: None,
            rule_name: None,
            assignee: None,
            assign_field: None,
        }));
    };

    // --- 3. pick the assignee ------------------------------------------------
    let assignee: String = match rule.strategy {
        RuleStrategy::Fixed => rule.assignees[0].clone(),
        RuleStrategy::RoundRobin => {
            // Atomic rotation: serialize the cursor bump on the rule document.
            let after = rules_coll
                .find_one_and_update(
                    doc! { "projectId": project_id, "_id": rule.oid },
                    doc! { "$inc": { "lastAssignedIndex": 1_i64 } },
                )
                .return_document(mongodb::options::ReturnDocument::After)
                .await
                .map_err(|e| db_err(e, "sabcrm_routing_rules.round_robin.inc"))?
                .ok_or_else(|| ApiError::NotFound("routing rule".to_owned()))?;
            let incremented = after.get_i64("lastAssignedIndex").unwrap_or(1);
            pick_round_robin(&rule.assignees, incremented)
                .cloned()
                .ok_or_else(|| {
                    ApiError::Validation("rule has no assignees.".to_owned())
                })?
        }
        RuleStrategy::LeastAssigned => {
            // Count live records currently assigned to each roster member on
            // this object; ties keep roster order (stable for small teams).
            let assign_key = format!("data.{}", rule.assign_field);
            let mut best: Option<(u64, &String)> = None;
            for member in &rule.assignees {
                let count = records
                    .count_documents(doc! {
                        "projectId": project_id,
                        "object": object_slug,
                        assign_key.as_str(): member,
                        "deletedAt": Bson::Null,
                    })
                    .await
                    .map_err(|e| db_err(e, "sabcrm_records.least_assigned.count"))?;
                match best {
                    Some((b, _)) if b <= count => {}
                    _ => best = Some((count, member)),
                }
            }
            best.map(|(_, m)| m.clone())
                .ok_or_else(|| ApiError::Validation("rule has no assignees.".to_owned()))?
        }
    };

    // --- 4. write the assignment ---------------------------------------------
    let now = Utc::now().to_rfc3339();
    let assign_key = format!("data.{}", rule.assign_field);
    records
        .update_one(
            doc! { "projectId": project_id, "object": object_slug, "_id": record_oid },
            doc! { "$set": {
                assign_key.as_str(): &assignee,
                "updatedAt": &now,
            } },
        )
        .await
        .map_err(|e| db_err(e, "sabcrm_records.evaluate.update_one"))?;

    Ok(Json(EvaluateResponse {
        matched: true,
        rule_id: Some(rule.oid.to_hex()),
        rule_name: Some(rule.name),
        assignee: Some(assignee),
        assign_field: Some(rule.assign_field),
    }))
}

// ===========================================================================
// tests — pure helpers: condition vocabulary + round-robin rotation
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn cond(field: &str, operator: &str, value: Value) -> RuleCondition {
        RuleCondition {
            field: field.to_owned(),
            operator: operator.to_owned(),
            value: Some(value),
        }
    }

    /// `eq` / `ne` use loose (stringified) equality like the TS runtime.
    #[test]
    fn eval_eq_ne_loose() {
        let data = json!({ "source": "web", "score": 5 });
        assert!(eval_condition(&cond("source", "eq", json!("web")), &data));
        assert!(eval_condition(&cond("score", "eq", json!("5")), &data), "loose: 5 == \"5\"");
        assert!(eval_condition(&cond("source", "ne", json!("ads")), &data));
        assert!(!eval_condition(&cond("source", "ne", json!("web")), &data));
    }

    /// `in` accepts arrays AND CSV strings; `contains` is substring.
    #[test]
    fn eval_in_contains() {
        let data = json!({ "source": "web", "city": "New Delhi" });
        assert!(eval_condition(&cond("source", "in", json!(["ads", "web"])), &data));
        assert!(eval_condition(&cond("source", "in", json!("ads, web")), &data));
        assert!(!eval_condition(&cond("source", "in", json!(["ads"])), &data));
        assert!(eval_condition(&cond("city", "contains", json!("Delhi")), &data));
        assert!(!eval_condition(&cond("city", "contains", json!("Mumbai")), &data));
    }

    /// Ordered operators coerce numerics; dotted fields walk nested maps.
    #[test]
    fn eval_ordered_and_dotted() {
        let data = json!({ "score": "42", "company": { "size": 10 } });
        assert!(eval_condition(&cond("score", "gte", json!(42)), &data));
        assert!(!eval_condition(&cond("score", "lt", json!(42)), &data));
        assert!(eval_condition(&cond("company.size", "gt", json!(5)), &data));
    }

    /// Unknown operators FAIL CLOSED (never match), and an empty condition
    /// list matches everything.
    #[test]
    fn eval_fail_closed_and_empty_list() {
        let data = json!({ "source": "web" });
        assert!(!eval_condition(&cond("source", "definitely_not_an_op", json!("web")), &data));
        assert!(conditions_match(&[], &data), "no conditions → unconditional rule");
        assert!(!conditions_match(
            &[
                cond("source", "eq", json!("web")),
                cond("source", "eq", json!("ads")),
            ],
            &data,
        ), "conditions are ANDed");
    }

    /// Round-robin rotation: post-`$inc` cursors 1,2,3,... walk the roster
    /// from the first member and wrap.
    #[test]
    fn round_robin_rotation() {
        let roster = vec!["a".to_owned(), "b".to_owned(), "c".to_owned()];
        let picks: Vec<&str> = (1..=7)
            .map(|i| pick_round_robin(&roster, i).expect("pick").as_str())
            .collect();
        assert_eq!(picks, ["a", "b", "c", "a", "b", "c", "a"]);
    }

    /// Round-robin tolerates a legacy / skewed cursor (negative or huge) and
    /// an empty roster.
    #[test]
    fn round_robin_edge_cases() {
        let roster = vec!["a".to_owned(), "b".to_owned()];
        assert_eq!(pick_round_robin(&roster, 0).map(String::as_str), Some("b"), "rem_euclid handles 0");
        assert_eq!(pick_round_robin(&roster, -5).map(String::as_str), Some("a"));
        assert_eq!(pick_round_robin(&roster, i64::MAX).map(String::as_str), Some("a"));
        assert_eq!(pick_round_robin(&[], 1), None);
    }
}
