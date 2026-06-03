//! HTTP handlers for the SabChat **HRM-aware shift presence** domain.
//!
//! Two responsibilities live here:
//!
//! 1. **Rule CRUD** — tenant-scoped CRUD over `sabchat_shift_rules`.
//!    Each rule answers the question "when an employee's attendance is
//!    `whenStatus`, set their SabChat presence to `setPresence`".
//! 2. **HRM bridge** — walk today's `crm_attendance` rows for the
//!    calling tenant, map `employeeId → agentId` via `crm_employees`,
//!    apply the active rule set, and write `sabchat_agent_presence` with
//!    `setBy = "hrm"`.
//!
//! ## Collections
//!
//! | Collection                | Direction | Used by                       |
//! |---------------------------|-----------|-------------------------------|
//! | `sabchat_shift_rules`     | r/w       | rule CRUD + sync/preview      |
//! | `crm_attendance`          | r         | sync/preview                  |
//! | `crm_employees`           | r         | sync/preview                  |
//! | `sabchat_agent_presence`  | w         | sync                          |
//!
//! ## Tenancy
//!
//! Every read and write filters on `tenant_id = ObjectId(auth.tenant_id)`.
//! A malformed JWT subject yields [`ApiError::Unauthorized`] — no
//! cross-tenant access is possible from the wire.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use std::collections::HashMap;
use tracing::instrument;

use crate::dto::{
    CreateRuleBody, CreateRuleResponse, GetRuleResponse, ListRulesResponse, PreviewQuery,
    PreviewResponse, SuccessResponse, SyncBody, SyncReport, UpdateRuleBody,
    VALID_PRESENCE_STATUSES, VALID_WHEN_STATUSES,
};
use crate::state::SabChatShiftsState;

// ---------------------------------------------------------------------------
// Collection names — inline so each handler's I/O target is greppable.
// ---------------------------------------------------------------------------

const RULES_COLL: &str = "sabchat_shift_rules";
const ATTENDANCE_COLL: &str = "crm_attendance";
const EMPLOYEES_COLL: &str = "crm_employees";
const PRESENCE_COLL: &str = "sabchat_agent_presence";

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse the JWT tenant claim into an `ObjectId`. A malformed claim
/// yields `401 Unauthorized` — the token is structurally invalid, not
/// the request.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// Validate an inbound `whenStatus` against [`VALID_WHEN_STATUSES`].
/// Empty input is rejected with the same wording as the inbox crate's
/// presence validator for consistency.
fn validate_when_status(s: &str) -> Result<()> {
    if !VALID_WHEN_STATUSES.contains(&s) {
        return Err(ApiError::BadRequest(format!(
            "invalid whenStatus `{s}`; expected one of: {}",
            VALID_WHEN_STATUSES.join(", "),
        )));
    }
    Ok(())
}

/// Validate an inbound `setPresence` against [`VALID_PRESENCE_STATUSES`].
fn validate_set_presence(s: &str) -> Result<()> {
    if !VALID_PRESENCE_STATUSES.contains(&s) {
        return Err(ApiError::BadRequest(format!(
            "invalid setPresence `{s}`; expected one of: {}",
            VALID_PRESENCE_STATUSES.join(", "),
        )));
    }
    Ok(())
}

// ===========================================================================
// POST /v1/sabchat/shifts/rules — create_rule
// ===========================================================================

/// `POST /rules` — create a tenant-scoped shift rule.
#[instrument(skip_all)]
pub async fn create_rule(
    user: AuthUser,
    State(state): State<SabChatShiftsState>,
    Json(body): Json<CreateRuleBody>,
) -> Result<Json<CreateRuleResponse>> {
    let name = body.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let when = body.when_status.trim();
    let set = body.set_presence.trim();
    validate_when_status(when)?;
    validate_set_presence(set)?;

    let tenant_id = tenant_oid(&user)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();

    let doc = doc! {
        "_id": new_oid,
        "tenant_id": tenant_id,
        "name": name,
        "when_status": when,
        "set_presence": set,
        "active": body.active,
        "created_at": now,
        "updated_at": now,
    };

    state
        .mongo
        .collection::<Document>(RULES_COLL)
        .insert_one(doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_shift_rules.insert_one"))
        })?;

    Ok(Json(CreateRuleResponse {
        rule_id: new_oid.to_hex(),
    }))
}

// ===========================================================================
// GET /v1/sabchat/shifts/rules — list_rules
// ===========================================================================

/// `GET /rules` — list all rules for the calling tenant, newest first.
#[instrument(skip_all)]
pub async fn list_rules(
    user: AuthUser,
    State(state): State<SabChatShiftsState>,
) -> Result<Json<ListRulesResponse>> {
    let tenant_id = tenant_oid(&user)?;

    let opts = FindOptions::builder()
        .sort(doc! { "created_at": -1 })
        .build();

    let cursor = state
        .mongo
        .collection::<Document>(RULES_COLL)
        .find(doc! { "tenant_id": tenant_id })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_shift_rules.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_shift_rules.collect"))
    })?;

    let rules = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListRulesResponse { rules }))
}

// ===========================================================================
// GET /v1/sabchat/shifts/rules/:id — get_rule
// ===========================================================================

/// `GET /rules/:id` — fetch a single rule by id; 404 when not found in
/// the calling tenant's scope.
#[instrument(skip_all, fields(rule_id = %rule_id))]
pub async fn get_rule(
    user: AuthUser,
    State(state): State<SabChatShiftsState>,
    Path(rule_id): Path<String>,
) -> Result<Json<GetRuleResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let rule_oid =
        oid_from_str(&rule_id).map_err(|_| ApiError::BadRequest("invalid rule id".to_owned()))?;

    let found = state
        .mongo
        .collection::<Document>(RULES_COLL)
        .find_one(doc! { "_id": rule_oid, "tenant_id": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_shift_rules.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("rule not found".to_owned()))?;

    Ok(Json(GetRuleResponse {
        rule: document_to_clean_json(found),
    }))
}

// ===========================================================================
// PATCH /v1/sabchat/shifts/rules/:id — update_rule
// ===========================================================================

/// `PATCH /rules/:id` — partial update; rejects empty bodies.
#[instrument(skip_all, fields(rule_id = %rule_id))]
pub async fn update_rule(
    user: AuthUser,
    State(state): State<SabChatShiftsState>,
    Path(rule_id): Path<String>,
    Json(body): Json<UpdateRuleBody>,
) -> Result<Json<SuccessResponse>> {
    if body.is_empty() {
        return Err(ApiError::BadRequest("no fields to update".to_owned()));
    }
    let tenant_id = tenant_oid(&user)?;
    let rule_oid =
        oid_from_str(&rule_id).map_err(|_| ApiError::BadRequest("invalid rule id".to_owned()))?;

    let mut set = doc! { "updated_at": bson::DateTime::from_chrono(Utc::now()) };
    if let Some(name) = body
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set.insert("name", name);
    }
    if let Some(when) = body.when_status.as_deref().map(str::trim) {
        validate_when_status(when)?;
        set.insert("when_status", when);
    }
    if let Some(s) = body.set_presence.as_deref().map(str::trim) {
        validate_set_presence(s)?;
        set.insert("set_presence", s);
    }
    if let Some(active) = body.active {
        set.insert("active", active);
    }

    let res = state
        .mongo
        .collection::<Document>(RULES_COLL)
        .update_one(
            doc! { "_id": rule_oid, "tenant_id": tenant_id },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_shift_rules.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("rule not found".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/sabchat/shifts/rules/:id — delete_rule
// ===========================================================================

/// `DELETE /rules/:id` — tenant-scoped hard delete.
#[instrument(skip_all, fields(rule_id = %rule_id))]
pub async fn delete_rule(
    user: AuthUser,
    State(state): State<SabChatShiftsState>,
    Path(rule_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let rule_oid =
        oid_from_str(&rule_id).map_err(|_| ApiError::BadRequest("invalid rule id".to_owned()))?;

    let res = state
        .mongo
        .collection::<Document>(RULES_COLL)
        .delete_one(doc! { "_id": rule_oid, "tenant_id": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_shift_rules.delete_one"))
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("rule not found".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /v1/sabchat/shifts/sync — sync
// ===========================================================================

/// `POST /sync` — cron-callable. Walks today's `crm_attendance` for the
/// tenant, maps employees to agents, applies active rules, and writes
/// presence rows.
#[instrument(skip_all)]
pub async fn sync(
    user: AuthUser,
    State(state): State<SabChatShiftsState>,
    Json(_body): Json<SyncBody>,
) -> Result<Json<SyncReport>> {
    let tenant_id = tenant_oid(&user)?;
    let report = sync_tenant_inner(&state.mongo, tenant_id)
        .await
        .map_err(ApiError::Internal)?;
    Ok(Json(report))
}

// ===========================================================================
// GET /v1/sabchat/shifts/preview — preview
// ===========================================================================

/// `GET /preview?agentId=` — what would `/sync` write for this agent? No
/// `sabchat_agent_presence` writes happen on this path.
#[instrument(skip_all, fields(agent_id = %query.agent_id))]
pub async fn preview(
    user: AuthUser,
    State(state): State<SabChatShiftsState>,
    Query(query): Query<PreviewQuery>,
) -> Result<Json<PreviewResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let agent_oid = oid_from_str(&query.agent_id)
        .map_err(|_| ApiError::BadRequest("invalid agentId".to_owned()))?;

    // 1) Find the employee row whose `userId == agentId` (this is the
    //    canonical mapping per the task spec — `crm_employees._id` is the
    //    employee primary key, and the `userId` field links to the agent
    //    / chat user that drives `sabchat_agent_presence.agentId`).
    let employee = find_employee_for_agent(&state.mongo, tenant_id, agent_oid).await?;
    let Some(employee) = employee else {
        return Ok(Json(PreviewResponse {
            effective_presence: "offline".to_owned(),
            source: "no-employee".to_owned(),
            from_rule: None,
            attendance_status: None,
        }));
    };
    let employee_id = employee
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("employee missing _id")))?;

    // 2) Pull today's attendance row for that employee. If the tenant
    //    has multiple punches, we trust the most recent `checkInAt` /
    //    `checkOutAt` so a mid-day status flip is honoured.
    let attendance = latest_attendance_today(&state.mongo, tenant_id, employee_id).await?;
    let Some(att_status) = attendance
        .as_ref()
        .and_then(|d| d.get_str("status").ok().map(|s| s.to_owned()))
    else {
        return Ok(Json(PreviewResponse {
            effective_presence: "offline".to_owned(),
            source: "no-attendance".to_owned(),
            from_rule: None,
            attendance_status: None,
        }));
    };

    // 3) Find an active rule for the tenant whose `when_status` matches.
    let rule = state
        .mongo
        .collection::<Document>(RULES_COLL)
        .find_one(doc! {
            "tenant_id": tenant_id,
            "active": true,
            "when_status": &att_status,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_shift_rules.find_one"))
        })?;

    match rule {
        Some(r) => {
            let set_presence = r
                .get_str("set_presence")
                .map(str::to_owned)
                .unwrap_or_else(|_| "offline".to_owned());
            let rule_id = r.get_object_id("_id").ok().map(|o| o.to_hex());
            Ok(Json(PreviewResponse {
                effective_presence: set_presence,
                source: "hrm-rule".to_owned(),
                from_rule: rule_id,
                attendance_status: Some(att_status),
            }))
        }
        None => {
            // Fall back to a sensible default per attendance state so the
            // UI can still paint something useful even without a rule.
            let default_presence = default_presence_for(&att_status);
            Ok(Json(PreviewResponse {
                effective_presence: default_presence.to_owned(),
                source: "hrm-default".to_owned(),
                from_rule: None,
                attendance_status: Some(att_status),
            }))
        }
    }
}

// ===========================================================================
// Public helper — `sync_tenant` (re-exported from `lib.rs`)
// ===========================================================================

/// Run the HRM-aware presence sync for one tenant. Intended for the
/// cron entry-point: no auth context, callers must have already proved
/// they own the tenant.
pub async fn sync_tenant(mongo: &MongoHandle, tenant_id: ObjectId) -> anyhow::Result<SyncReport> {
    sync_tenant_inner(mongo, tenant_id).await
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/// Core sync algorithm. Pulled out of [`sync`] so the public
/// [`sync_tenant`] helper can call it without an auth round-trip.
async fn sync_tenant_inner(mongo: &MongoHandle, tenant_id: ObjectId) -> anyhow::Result<SyncReport> {
    let (start, end) = today_window_utc();

    // 1) Load active rules for this tenant — small set, keep in memory.
    let rule_docs: Vec<Document> = mongo
        .collection::<Document>(RULES_COLL)
        .find(doc! { "tenant_id": tenant_id, "active": true })
        .await?
        .try_collect()
        .await?;
    let rule_map = compile_rule_map(&rule_docs);

    // 2) Walk today's attendance rows.
    let att_cursor = mongo
        .collection::<Document>(ATTENDANCE_COLL)
        .find(doc! {
            "tenantId": tenant_id,
            "date": {
                "$gte": bson::DateTime::from_chrono(start),
                "$lt": bson::DateTime::from_chrono(end),
            },
        })
        .await?;
    let att_rows: Vec<Document> = att_cursor.try_collect().await?;
    let scanned = att_rows.len() as u64;
    if scanned == 0 {
        return Ok(SyncReport::default());
    }

    // 3) Collect unique employee ids → bulk-lookup matching employees
    //    (a single find with `$in` is cheaper than N round-trips).
    let mut employee_ids: Vec<ObjectId> = att_rows
        .iter()
        .filter_map(|d| d.get_object_id("employeeId").ok())
        .collect();
    employee_ids.sort();
    employee_ids.dedup();
    if employee_ids.is_empty() {
        return Ok(SyncReport {
            scanned,
            updated: 0,
        });
    }
    let emp_cursor = mongo
        .collection::<Document>(EMPLOYEES_COLL)
        .find(doc! {
            "tenantId": tenant_id,
            "_id": { "$in": employee_ids.clone() },
        })
        .await?;
    let employees: Vec<Document> = emp_cursor.try_collect().await?;

    // employeeId -> userId (the agent id used on sabchat_agent_presence)
    let mut emp_to_agent: HashMap<ObjectId, ObjectId> = HashMap::with_capacity(employees.len());
    for emp in &employees {
        let (Ok(id), Ok(uid)) = (emp.get_object_id("_id"), emp.get_object_id("userId")) else {
            continue;
        };
        emp_to_agent.insert(id, uid);
    }

    // 4) Resolve a single best status per employee (latest punch wins).
    let mut best_status: HashMap<ObjectId, String> = HashMap::with_capacity(att_rows.len());
    let mut best_at: HashMap<ObjectId, chrono::DateTime<Utc>> =
        HashMap::with_capacity(att_rows.len());
    for row in &att_rows {
        let Ok(emp_id) = row.get_object_id("employeeId") else {
            continue;
        };
        let Ok(status) = row.get_str("status") else {
            continue;
        };
        let stamp = row
            .get_datetime("checkOutAt")
            .ok()
            .or_else(|| row.get_datetime("checkInAt").ok())
            .map(|dt| dt.to_chrono())
            .unwrap_or(start);

        if let Some(prev) = best_at.get(&emp_id) {
            if stamp <= *prev {
                continue;
            }
        }
        best_status.insert(emp_id, status.to_owned());
        best_at.insert(emp_id, stamp);
    }

    // 5) Apply rules and upsert presence rows.
    let now = bson::DateTime::from_chrono(Utc::now());
    let presence = mongo.collection::<Document>(PRESENCE_COLL);
    let mut updated: u64 = 0;
    for (emp_id, status) in best_status {
        let Some(agent_id) = emp_to_agent.get(&emp_id).copied() else {
            continue;
        };
        let set_presence = rule_map
            .get(status.as_str())
            .cloned()
            .unwrap_or_else(|| RuleHit {
                presence: default_presence_for(&status).to_owned(),
                rule_id: None,
            });

        let res = presence
            .update_one(
                doc! { "agentId": agent_id, "tenantId": tenant_id },
                doc! {
                    "$set": {
                        "status": &set_presence.presence,
                        "setAt": now,
                        "setBy": "hrm",
                        "tenantId": tenant_id,
                        "agentId": agent_id,
                    },
                    "$setOnInsert": { "_id": ObjectId::new() },
                },
            )
            .upsert(true)
            .await?;
        if res.upserted_id.is_some() || res.modified_count > 0 {
            updated += 1;
        }
    }

    Ok(SyncReport { scanned, updated })
}

/// Compiled rule lookup keyed by `when_status`.
#[derive(Clone)]
struct RuleHit {
    presence: String,
    #[allow(dead_code)]
    rule_id: Option<ObjectId>,
}

fn compile_rule_map(docs: &[Document]) -> HashMap<String, RuleHit> {
    let mut map: HashMap<String, RuleHit> = HashMap::with_capacity(docs.len());
    for d in docs {
        let Ok(when) = d.get_str("when_status") else {
            continue;
        };
        let Ok(presence) = d.get_str("set_presence") else {
            continue;
        };
        // First active rule wins (`find` cursor is ascending by Mongo's
        // natural order; callers can disable older rules to flip the
        // winner explicitly).
        map.entry(when.to_owned()).or_insert(RuleHit {
            presence: presence.to_owned(),
            rule_id: d.get_object_id("_id").ok(),
        });
    }
    map
}

/// Best-effort default presence when no rule matches the attendance
/// status. Lets the inbox UI render *something* coherent even before the
/// tenant's admin authors rules.
fn default_presence_for(att_status: &str) -> &'static str {
    match att_status {
        "checked_in" => "online",
        "on_break" => "away",
        "checked_out" => "offline",
        _ => "offline",
    }
}

/// Today window in UTC — `[00:00:00, 24:00:00)`. The HRM module already
/// normalises `date` to start-of-day so a UTC-bounded window matches the
/// stored values precisely; per-tenant timezone math is the responsibility
/// of the HRM writer.
fn today_window_utc() -> (chrono::DateTime<Utc>, chrono::DateTime<Utc>) {
    let now = Utc::now();
    let start = Utc
        .with_ymd_and_hms(now.year_part(), now.month_part(), now.day_part(), 0, 0, 0)
        .single()
        .unwrap_or(now);
    let end = start + chrono::Duration::days(1);
    (start, end)
}

/// Local helper trait so the today-window math is greppable.
trait DateParts {
    fn year_part(&self) -> i32;
    fn month_part(&self) -> u32;
    fn day_part(&self) -> u32;
}
impl DateParts for chrono::DateTime<Utc> {
    fn year_part(&self) -> i32 {
        use chrono::Datelike;
        self.year()
    }
    fn month_part(&self) -> u32 {
        use chrono::Datelike;
        self.month()
    }
    fn day_part(&self) -> u32 {
        use chrono::Datelike;
        self.day()
    }
}

/// Lookup the employee row whose `userId == agent_id` under the given
/// tenant. Returns `None` if no mapping exists — the caller surfaces a
/// `no-employee` source for the preview endpoint.
async fn find_employee_for_agent(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    agent_id: ObjectId,
) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(EMPLOYEES_COLL)
        .find_one(doc! { "tenantId": tenant_id, "userId": agent_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_employees.find_one")))
}

/// Latest attendance row in today's window for the given employee.
async fn latest_attendance_today(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    employee_id: ObjectId,
) -> Result<Option<Document>> {
    let (start, end) = today_window_utc();
    let opts = FindOptions::builder()
        .sort(doc! { "checkOutAt": -1, "checkInAt": -1, "date": -1 })
        .limit(1)
        .build();
    let mut cursor = mongo
        .collection::<Document>(ATTENDANCE_COLL)
        .find(doc! {
            "tenantId": tenant_id,
            "employeeId": employee_id,
            "date": {
                "$gte": bson::DateTime::from_chrono(start),
                "$lt": bson::DateTime::from_chrono(end),
            },
        })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_attendance.find")))?;
    cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_attendance.try_next")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_presence_mapping_is_sensible() {
        assert_eq!(default_presence_for("checked_in"), "online");
        assert_eq!(default_presence_for("on_break"), "away");
        assert_eq!(default_presence_for("checked_out"), "offline");
        assert_eq!(default_presence_for("bogus"), "offline");
    }

    #[test]
    fn today_window_is_exactly_one_day() {
        let (start, end) = today_window_utc();
        assert_eq!(end - start, chrono::Duration::days(1));
    }

    #[test]
    fn compile_rule_map_prefers_first_match() {
        let r1 = doc! {
            "_id": ObjectId::new(),
            "when_status": "checked_in",
            "set_presence": "online",
        };
        let r2 = doc! {
            "_id": ObjectId::new(),
            "when_status": "checked_in",
            "set_presence": "busy",
        };
        let map = compile_rule_map(&[r1, r2]);
        assert_eq!(map.get("checked_in").unwrap().presence, "online");
    }
}
