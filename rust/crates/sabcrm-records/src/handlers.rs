//! HTTP handlers for the SabCRM generic records domain.
//!
//! A single metadata-driven CRUD surface over the `sabcrm_records` Mongo
//! collection. Every object (companies, people, opportunities, …) routes
//! through the same handlers — the `{object}` path segment is the object
//! slug.
//!
//! | Endpoint                              | TS source (sabcrm `*.server.ts`)        |
//! |---------------------------------------|-----------------------------------------|
//! | `GET    /v1/sabcrm/records/{object}`         | `listRecords`                    |
//! | `POST   /v1/sabcrm/records/{object}`         | `createRecord`                   |
//! | `GET    /v1/sabcrm/records/{object}/{id}`    | `getRecord`                      |
//! | `PATCH  /v1/sabcrm/records/{object}/{id}`    | `updateRecord`                   |
//! | `DELETE /v1/sabcrm/records/{object}/{id}`    | `deleteRecord`                   |
//! | `POST   /v1/sabcrm/records/{object}/group`   | `groupRecords` (kanban)          |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string>, object: <slug> }`
//! — **not** `userId`. `projectId` arrives as a query/body string and
//! `object` is the path slug. Every handler still requires the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor so the surface is never
//! anonymously open, but the caller's user id is not part of the filter.

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
    AggregateGroup, AggregateInput, AggregateResponse, BulkDeleteInput, BulkDeleteResponse,
    BulkUpdateInput, BulkUpdateResponse, CountQuery, CountResponse, CreateRecordInput,
    DistinctQuery, DistinctResponse, DuplicateGroup, DuplicatesQuery, DuplicatesResponse,
    GroupRecordsInput, GroupResponse, ListQuery, ListResponse, MergeRecordsInput, OkResponse,
    RecordGroup, RecordRelation, RecordResponse, RelationHint, RelationsResponse, ScopeQuery,
    SearchHit, SearchQuery, SearchResponse, UpdateRecordInput,
};

/// The single Mongo collection backing every SabCRM object.
const RECORDS_COLL: &str = "sabcrm_records";

/// Timeline activities collection — re-pointed on merge so a secondary
/// record's activities survive on the surviving primary.
const ACTIVITIES_COLL: &str = "sabcrm_activities";

/// Default page size for the list endpoint when no `limit` is supplied.
const DEFAULT_LIMIT: u64 = 20;
/// Hard cap on `limit` per slice contract.
const MAX_LIMIT: u64 = 100;
/// Hard cap on records returned per kanban column.
const MAX_GROUP_RECORDS: i64 = 100;
/// Hard cap on records returned per relation block.
const MAX_RELATION_RECORDS: i64 = 50;
/// Hard cap on buckets returned by the aggregate endpoint.
const MAX_AGGREGATE_GROUPS: i64 = 200;
/// Hard cap on values returned by the distinct endpoint.
const MAX_DISTINCT_VALUES: usize = 200;
/// Hard cap on duplicate groups returned by the duplicates endpoint.
const MAX_DUPLICATE_GROUPS: i64 = 100;
/// Hard cap on records returned per duplicate group.
const MAX_DUPLICATE_RECORDS: usize = 10;
/// Hard cap on hits returned by the cross-object global search endpoint.
const MAX_SEARCH_HITS: i64 = 50;

/// Top-level marker fields injected into an enriched record (`?enrich=relations`).
/// `__relations` maps each RELATION fieldKey → a [`RelationHint`](crate::dto::RelationHint)
/// (or `null`); `__actors` maps `createdBy` → a `RelationHint`. Both are
/// double-underscore prefixed so they never collide with a user `data.*` key
/// and are trivially strippable client-side.
const RELATIONS_KEY: &str = "__relations";
const ACTORS_KEY: &str = "__actors";

/// `data.*` keys probed for an avatar / logo URL hint when enriching a relation
/// target, in priority order.
const AVATAR_FIELDS: &[&str] = &["avatar", "logo", "avatarUrl", "logoUrl", "photo", "image"];

/// Common `data.*` keys probed by the free-text `q` filter. Covers the
/// label fields of the six standard objects.
const SEARCH_FIELDS: &[&str] = &[
    "name",
    "title",
    "firstName",
    "lastName",
    "email",
    "phone",
    "jobTitle",
    "body",
];

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

/// Base tenant filter shared by every query: `{ projectId, object }`. Matches
/// ALL records in scope, **including** soft-deleted (trashed) ones — used by
/// the by-id endpoints (get / update / delete / trash / restore / permanent)
/// which must still resolve a trashed record.
fn scope(project_id: &str, object: &str) -> Document {
    doc! { "projectId": project_id, "object": object }
}

/// Top-level marker field that flags a record as soft-deleted (trashed). When
/// present it holds the RFC3339 timestamp of the trash action; absent / null
/// means the record is live.
const DELETED_AT: &str = "deletedAt";

/// The "not trashed" predicate: `deletedAt ∈ [null]` — matches records where
/// `deletedAt` is JSON `null` **or** the field is absent (Mongo `$in: [null]`
/// also matches missing fields). Merged into the base [`scope`] for every
/// normal read so trashed records are hidden from default views.
fn not_trashed() -> (String, Bson) {
    (DELETED_AT.to_owned(), Bson::Document(doc! { "$in": [Bson::Null] }))
}

/// `{ projectId, object }` **excluding** trashed records — the live-records
/// scope used by list / count / group / aggregate.
fn active_scope(project_id: &str, object: &str) -> Document {
    let mut filter = scope(project_id, object);
    let (k, v) = not_trashed();
    filter.insert(k, v);
    filter
}

/// Convert an incoming JSON `data` object into a BSON `Document`.
/// Non-object payloads are rejected with a 422.
fn data_to_doc(data: &Value) -> Result<Document> {
    match bson::to_bson(data).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.data.to_bson"))
    })? {
        Bson::Document(d) => Ok(d),
        _ => Err(ApiError::Validation("`data` must be an object.".to_owned())),
    }
}

/// Convert a `serde_json::Value` (a filter operand) into BSON. Used for the
/// right-hand side of structured filter conditions. Bad payloads surface as
/// a `400` rather than a `500` — the input is client-controlled.
fn value_to_bson(v: &Value) -> Result<Bson> {
    bson::to_bson(v)
        .map_err(|e| ApiError::BadRequest(format!("invalid filter value: {e}")))
}

/// Render a `serde_json::Value` as the string used by the case-insensitive
/// `contains` regex. Strings are used verbatim (un-quoted); other scalars are
/// stringified.
fn value_to_regex_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

/// Translate one `{ "op": ..., "value": ... }` condition (or a bare scalar)
/// into the Mongo predicate applied to `data.<fieldKey>`. Returns the value
/// that should be assigned to the `data.<fieldKey>` key in the Mongo filter.
///
/// Supported ops:
/// - `eq` → `<v>` (bare equality)
/// - `ne` → `{ "$ne": <v> }`
/// - `contains` → `{ "$regex": <stringified v>, "$options": "i" }`
/// - `gt` / `lt` / `gte` / `lte` → `{ "$gt"|"$lt"|"$gte"|"$lte": <v> }`
/// - `in` → `{ "$in": <array v> }`
/// - `isEmpty` → `{ "$in": [null, ""] }` (also matches missing via Mongo)
/// - `isNotEmpty` → `{ "$nin": [null, ""], "$exists": true }`
fn condition_to_bson(cond: &Value) -> Result<Bson> {
    // Bare scalar → equality.
    let obj = match cond {
        Value::Object(map) => map,
        scalar => return value_to_bson(scalar),
    };

    // An object without an `op` key is treated as a literal equality operand
    // (e.g. an embedded document compared by value).
    let op = match obj.get("op").and_then(Value::as_str) {
        Some(op) => op,
        None => return value_to_bson(cond),
    };

    let value = obj.get("value").unwrap_or(&Value::Null);

    let predicate = match op {
        "eq" => return value_to_bson(value),
        "ne" => doc! { "$ne": value_to_bson(value)? },
        "contains" => doc! {
            "$regex": value_to_regex_string(value),
            "$options": "i",
        },
        "gt" => doc! { "$gt": value_to_bson(value)? },
        "lt" => doc! { "$lt": value_to_bson(value)? },
        "gte" => doc! { "$gte": value_to_bson(value)? },
        "lte" => doc! { "$lte": value_to_bson(value)? },
        "in" => {
            let arr = value.as_array().ok_or_else(|| {
                ApiError::BadRequest("`in` filter requires an array value.".to_owned())
            })?;
            let items: Vec<Bson> = arr
                .iter()
                .map(value_to_bson)
                .collect::<Result<Vec<_>>>()?;
            doc! { "$in": items }
        }
        "isEmpty" => doc! { "$in": [Bson::Null, Bson::String(String::new())] },
        "isNotEmpty" => doc! {
            "$nin": [Bson::Null, Bson::String(String::new())],
            "$exists": true,
        },
        other => {
            return Err(ApiError::BadRequest(format!(
                "unsupported filter op `{other}`."
            )));
        }
    };

    Ok(Bson::Document(predicate))
}

/// Translate a single leaf condition `{ "field", "operator", "value" }` of a
/// nested filter group into a Mongo predicate document
/// `{ "data.<field>": <predicate> }`. Reuses [`condition_to_bson`] by lifting
/// `operator`/`value` into the `{ "op", "value" }` shape it already speaks.
fn leaf_to_filter_doc(obj: &serde_json::Map<String, Value>) -> Result<Document> {
    let field = obj
        .get("field")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            ApiError::BadRequest("filter condition requires a non-empty `field`.".to_owned())
        })?;

    let operator = obj.get("operator").and_then(Value::as_str).ok_or_else(|| {
        ApiError::BadRequest("filter condition requires an `operator`.".to_owned())
    })?;

    // Re-shape into the `{ "op", "value" }` form `condition_to_bson` consumes.
    let cond = serde_json::json!({
        "op": operator,
        "value": obj.get("value").cloned().unwrap_or(Value::Null),
    });
    let predicate = condition_to_bson(&cond)?;

    let mut out = Document::new();
    out.insert(format!("data.{field}"), predicate);
    Ok(out)
}

/// Translate one element of a nested group's `conditions` array into a Mongo
/// filter document — either a leaf (has `field` + `operator`) or another
/// nested group (has `op` + `conditions`). Recurses for nested groups.
fn group_element_to_doc(el: &Value) -> Result<Document> {
    let obj = match el {
        Value::Object(map) => map,
        _ => {
            return Err(ApiError::BadRequest(
                "each filter condition must be a JSON object.".to_owned(),
            ));
        }
    };

    // A nested group: `{ "op": "and" | "or", "conditions": [...] }`.
    if obj.contains_key("conditions") {
        return group_to_filter_doc(obj);
    }

    // Otherwise a leaf condition: `{ "field", "operator", "value" }`.
    leaf_to_filter_doc(obj)
}

/// Translate a nested filter group `{ "op": "and" | "or", "conditions": [...] }`
/// into a single Mongo `{ "$and" | "$or": [ <doc>, ... ] }` document. An empty
/// `conditions` array yields an empty (match-all) document. A bad `op` or a
/// malformed element yields a `400`.
fn group_to_filter_doc(obj: &serde_json::Map<String, Value>) -> Result<Document> {
    let op = obj
        .get("op")
        .and_then(Value::as_str)
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| {
            ApiError::BadRequest("filter group requires an `op` (`and` | `or`).".to_owned())
        })?;

    let mongo_op = match op.as_str() {
        "and" => "$and",
        "or" => "$or",
        other => {
            return Err(ApiError::BadRequest(format!(
                "filter group `op` must be `and` or `or`, got `{other}`."
            )));
        }
    };

    let conditions = obj.get("conditions").and_then(Value::as_array).ok_or_else(|| {
        ApiError::BadRequest("filter group requires a `conditions` array.".to_owned())
    })?;

    // An empty group is a match-all (no predicate added) — avoid emitting an
    // empty `$and`/`$or`, which Mongo rejects.
    if conditions.is_empty() {
        return Ok(Document::new());
    }

    let branches: Vec<Bson> = conditions
        .iter()
        .map(|el| group_element_to_doc(el).map(Bson::Document))
        .collect::<Result<Vec<_>>>()?;

    let mut out = Document::new();
    out.insert(mongo_op, Bson::Array(branches));
    Ok(out)
}

/// Parse the optional URL-encoded JSON `filters` query param and merge it into
/// the supplied Mongo `filter`. Two shapes are accepted:
///
/// - **flat map** — `{ "<fieldKey>": <condition>, ... }`: each entry is ANDed
///   in as `data.<fieldKey> <predicate>` (the original behaviour).
/// - **nested group** — `{ "op": "and" | "or", "conditions": [...] }`:
///   translated to a Mongo `$and` / `$or` (see [`group_to_filter_doc`]) and
///   merged into `filter` under that operator key.
///
/// The shape is detected by the presence of an `op` + `conditions` pair. Bad
/// JSON, a non-object root, or an unsupported op yields a `400`; an absent /
/// empty param is a no-op.
fn apply_filters(filter: &mut Document, filters: Option<&str>) -> Result<()> {
    let raw = match filters.map(str::trim).filter(|s| !s.is_empty()) {
        Some(raw) => raw,
        None => return Ok(()),
    };

    let parsed: Value = serde_json::from_str(raw)
        .map_err(|e| ApiError::BadRequest(format!("invalid `filters` JSON: {e}")))?;

    let map = match parsed {
        Value::Object(map) => map,
        _ => {
            return Err(ApiError::BadRequest(
                "`filters` must be a JSON object.".to_owned(),
            ));
        }
    };

    // Nested-group form: `{ "op", "conditions" }`. Detected by the pair so a
    // user field literally named `op` in the flat form isn't misread.
    if map.contains_key("op") && map.contains_key("conditions") {
        let group = group_to_filter_doc(&map)?;
        for (k, v) in group {
            filter.insert(k, v);
        }
        return Ok(());
    }

    // Flat-map form: each `{ "<fieldKey>": <condition> }` ANDed in.
    for (field, cond) in &map {
        let key = field.trim();
        if key.is_empty() {
            continue;
        }
        let predicate = condition_to_bson(cond)?;
        filter.insert(format!("data.{key}"), predicate);
    }

    Ok(())
}

/// Build the Mongo filter shared by `list_records` and `count_records`:
/// the `{ projectId, object }` tenant scope, plus the optional free-text `q`
/// (case-insensitive regex `$or` over [`SEARCH_FIELDS`]) and the structured
/// `filters` JSON (ANDed in via [`apply_filters`]). A bad `filters` JSON or an
/// unsupported op yields a `400`.
fn build_list_filter(
    project_id: &str,
    object: &str,
    q: Option<&str>,
    filters: Option<&str>,
) -> Result<Document> {
    // Live records only — trashed (soft-deleted) records are hidden from
    // normal list/count/aggregate views.
    let mut filter = active_scope(project_id, object);

    if let Some(q) = q.map(str::trim).filter(|s| !s.is_empty()) {
        let ors: Vec<Bson> = SEARCH_FIELDS
            .iter()
            .map(|field| {
                Bson::Document(doc! {
                    format!("data.{field}"): { "$regex": q, "$options": "i" }
                })
            })
            .collect();
        filter.insert("$or", Bson::Array(ors));
    }

    apply_filters(&mut filter, filters)?;

    Ok(filter)
}

/// Clean a stored record into the wire JSON, renaming `_id` → `id` (hex).
/// `document_to_clean_json` already renders the `ObjectId` value as a hex
/// string; this just relabels the key to match the TS client contract.
fn record_to_wire(doc: Document) -> Value {
    let mut json = document_to_clean_json(doc);
    if let Value::Object(map) = &mut json {
        if let Some(id) = map.remove("_id") {
            map.insert("id".to_owned(), id);
        }
    }
    json
}

// ===========================================================================
// relation / ACTOR enrichment (?enrich=relations)
// ===========================================================================

/// Decode the `?enrich=` query value into "should we enrich?". Accepts
/// `relations` (the documented form) plus `1` / `true` / `all` as aliases,
/// case-insensitively; everything else (incl. absent) is `false` so legacy
/// callers are untouched.
fn wants_relation_enrichment(enrich: Option<&str>) -> bool {
    matches!(
        enrich.map(str::trim).map(str::to_ascii_lowercase).as_deref(),
        Some("relations") | Some("relation") | Some("1") | Some("true") | Some("all")
    )
}

/// The avatar/logo URL hint for a related target record's `data` sub-document,
/// probing [`AVATAR_FIELDS`] in priority order. `None` when none is a non-empty
/// string.
fn derive_avatar(data: &Document) -> Option<String> {
    for field in AVATAR_FIELDS {
        if let Some(v) = data_str(data, field) {
            return Some(v.to_owned());
        }
    }
    None
}

/// Build a [`RelationHint`] from a fetched target record `Document`, labelling
/// it via the relation's `labelField` (when that `data.<labelField>` is a
/// non-empty string) and otherwise falling back to the generic [`derive_label`]
/// derivation. `avatarUrl` is pulled from the target's avatar/logo fields.
fn hint_from_doc(doc: &Document, label_field: Option<&str>) -> RelationHint {
    let id = doc
        .get_object_id("_id")
        .map(|o| o.to_hex())
        .unwrap_or_default();
    let data = doc.get_document("data").ok();
    let label = match data {
        Some(data) => label_field
            .and_then(|lf| data_str(data, lf).map(str::to_owned))
            .unwrap_or_else(|| derive_label(data, &id)),
        None => id.clone(),
    };
    let avatar_url = data.and_then(derive_avatar);
    RelationHint {
        id,
        label,
        avatar_url,
    }
}

/// Resolve `createdBy` actor hints for a batch of source wire records. Actors
/// are looked up against the `workspaceMembers` object in the SAME
/// `sabcrm_records` collection (the CRM's actor table) by hex id; ids that
/// don't resolve are simply omitted. Returns a map `actorId → RelationHint`.
async fn fetch_actor_hints(
    coll: &mongodb::Collection<Document>,
    project_id: &str,
    actor_ids: &[String],
) -> Result<std::collections::HashMap<String, RelationHint>> {
    let mut out = std::collections::HashMap::new();
    if actor_ids.is_empty() {
        return Ok(out);
    }

    let oids: Vec<ObjectId> = actor_ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
        .collect();
    if oids.is_empty() {
        return Ok(out);
    }

    let mut filter = scope(project_id, "workspaceMembers");
    filter.insert("_id", doc! { "$in": oids });

    let mut cursor = coll.find(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.enrich.actors.find"))
    })?;
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.enrich.actors.cursor"))
    })? {
        let hint = hint_from_doc(&d, Some("name"));
        if !hint.id.is_empty() {
            out.insert(hint.id.clone(), hint);
        }
    }
    Ok(out)
}

/// One MANY_TO_ONE relation field to enrich: its source-record fieldKey, the
/// target object slug, and the target's `labelField`.
struct ManyToOneField {
    key: String,
    target_object: String,
    label_field: Option<String>,
}

/// The MANY_TO_ONE RELATION fields of `object`'s standard metadata (the only
/// ones with a scalar id stored on the source record, hence enrichable in a
/// batch list pass). Unknown / custom objects yield an empty list.
fn many_to_one_fields(object: &str) -> Vec<ManyToOneField> {
    match sabcrm_core::standard_object(object) {
        Some(meta) => meta
            .fields
            .into_iter()
            .filter_map(|f| match f.relation {
                Some(rel) if rel.kind == "MANY_TO_ONE" => Some(ManyToOneField {
                    key: f.key,
                    target_object: rel.target_object,
                    label_field: rel.label_field,
                }),
                _ => None,
            })
            .collect(),
        None => Vec::new(),
    }
}

/// Read the raw stored id string at `record["data"][key]` from an already-clean
/// wire record `Value`. Returns `None` for absent / non-string / blank values.
fn wire_data_str<'a>(record: &'a Value, key: &str) -> Option<&'a str> {
    record
        .get("data")
        .and_then(|d| d.get(key))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

/// Enrich a batch of wire records in place: for every MANY_TO_ONE RELATION
/// field of `object`, resolve the referenced target record's label + avatar
/// hint and inject a parallel `__relations` map; resolve each record's
/// top-level `createdBy` ACTOR into `__actors.createdBy`.
///
/// Resolution is batched (one `$in` query per distinct target object + one for
/// actors) to avoid N+1 fan-out across a list page. Targets that don't resolve
/// yield a `null` entry under their fieldKey so the client can distinguish
/// "no value" from "dangling id". Records are only touched when at least one
/// hint exists, keeping unenriched records byte-identical to the legacy shape.
async fn enrich_records(
    coll: &mongodb::Collection<Document>,
    project_id: &str,
    object: &str,
    records: &mut [Value],
) -> Result<()> {
    if records.is_empty() {
        return Ok(());
    }

    let rel_fields = many_to_one_fields(object);

    // ---- Batch-resolve relation targets, grouped by target object --------
    // targetObject → set of referenced hex ids (collected across all records).
    use std::collections::{HashMap, HashSet};
    let mut wanted: HashMap<String, HashSet<String>> = HashMap::new();
    for rec in records.iter() {
        for rf in &rel_fields {
            if let Some(id) = wire_data_str(rec, &rf.key) {
                wanted
                    .entry(rf.target_object.clone())
                    .or_default()
                    .insert(id.to_owned());
            }
        }
    }

    // targetObject → (id → RelationHint).
    let mut resolved: HashMap<String, HashMap<String, RelationHint>> = HashMap::new();
    for (target_object, ids) in &wanted {
        let oids: Vec<ObjectId> = ids
            .iter()
            .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
            .collect();
        if oids.is_empty() {
            continue;
        }
        // labelField is uniform per target object across our standard metadata;
        // grab it from the first rel field pointing at this target.
        let label_field = rel_fields
            .iter()
            .find(|rf| &rf.target_object == target_object)
            .and_then(|rf| rf.label_field.clone());

        let mut filter = scope(project_id, target_object);
        filter.insert("_id", doc! { "$in": oids });
        let mut cursor = coll.find(filter).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.enrich.find"))
        })?;
        let target_map = resolved.entry(target_object.clone()).or_default();
        while let Some(d) = cursor.try_next().await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.enrich.cursor"))
        })? {
            let hint = hint_from_doc(&d, label_field.as_deref());
            if !hint.id.is_empty() {
                target_map.insert(hint.id.clone(), hint);
            }
        }
    }

    // ---- Batch-resolve `createdBy` ACTOR hints ---------------------------
    let actor_ids: Vec<String> = records
        .iter()
        .filter_map(|r| {
            r.get("createdBy")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_owned)
        })
        .collect();
    let actor_hints = fetch_actor_hints(coll, project_id, &actor_ids).await?;

    // ---- Inject the parallel maps into each record -----------------------
    for rec in records.iter_mut() {
        let obj = match rec.as_object_mut() {
            Some(o) => o,
            None => continue,
        };

        if !rel_fields.is_empty() {
            let mut rel_map = serde_json::Map::new();
            for rf in &rel_fields {
                // Re-read the stored id (immutable borrow ended; read from obj).
                let stored = obj
                    .get("data")
                    .and_then(|d| d.get(&rf.key))
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(str::to_owned);
                let entry = match stored {
                    Some(id) => resolved
                        .get(&rf.target_object)
                        .and_then(|m| m.get(&id))
                        .map(|h| serde_json::to_value(h).unwrap_or(Value::Null))
                        .unwrap_or(Value::Null),
                    None => Value::Null,
                };
                rel_map.insert(rf.key.clone(), entry);
            }
            obj.insert(RELATIONS_KEY.to_owned(), Value::Object(rel_map));
        }

        if let Some(actor_id) = obj
            .get("createdBy")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
        {
            if let Some(hint) = actor_hints.get(&actor_id) {
                let mut actors = serde_json::Map::new();
                actors.insert(
                    "createdBy".to_owned(),
                    serde_json::to_value(hint).unwrap_or(Value::Null),
                );
                obj.insert(ACTORS_KEY.to_owned(), Value::Object(actors));
            }
        }
    }

    Ok(())
}

// ===========================================================================
// GET /{object} — listRecords
// ===========================================================================

/// `GET /v1/sabcrm/records/{object}` — paginated list scoped by
/// `{ projectId, object }`. Optional `q` matches a few common `data.*`
/// fields (case-insensitive regex); `sortBy` sorts on `data.<key>` (else
/// top-level `updatedAt`), `sortDir` defaults to `desc`.
#[instrument(skip_all, fields(object = %object))]
pub async fn list_records(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(object): Path<String>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    // ---- Pagination ----------------------------------------------------
    let page = query.page.filter(|p| *p > 0).unwrap_or(1);
    let limit = query
        .limit
        .filter(|l| *l > 0)
        .unwrap_or(DEFAULT_LIMIT)
        .min(MAX_LIMIT);
    let skip = (page - 1).saturating_mul(limit);

    // ---- Filter (free-text `q` + structured `filters`, shared with count) --
    let filter = build_list_filter(
        project_id,
        &object,
        query.q.as_deref(),
        query.filters.as_deref(),
    )?;

    // ---- Sort ----------------------------------------------------------
    let sort_dir = match query.sort_dir.as_deref().map(str::trim) {
        Some("asc") => 1,
        _ => -1, // default desc
    };
    let sort_key = match query
        .sort_by
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(key) => format!("data.{key}"),
        None => "updatedAt".to_owned(),
    };

    let coll = mongo.collection::<Document>(RECORDS_COLL);

    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.count")))?;

    let mut cursor = coll
        .find(filter)
        .sort(doc! { sort_key: sort_dir })
        .skip(skip)
        .limit(limit as i64)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.find")))?;

    let mut records = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.cursor")))?
    {
        records.push(record_to_wire(d));
    }

    // ---- Optional relation/actor enrichment (?enrich=relations) ----------
    if wants_relation_enrichment(query.enrich.as_deref()) {
        enrich_records(&coll, project_id, &object, &mut records).await?;
    }

    Ok(Json(ListResponse { records, total }))
}

// ===========================================================================
// GET /{object}/count — countRecords
// ===========================================================================

/// `GET /v1/sabcrm/records/{object}/count` — count of records matching the
/// SAME `{ projectId, object }` + `q` + `filters` predicate as
/// [`list_records`] (built via [`build_list_filter`]), ignoring pagination /
/// sort. Bad `filters` JSON → `400`.
#[instrument(skip_all, fields(object = %object))]
pub async fn count_records(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(object): Path<String>,
    Query(query): Query<CountQuery>,
) -> Result<Json<CountResponse>> {
    let project_id = require_project(&query.project_id)?;

    let filter = build_list_filter(
        project_id,
        &object,
        query.q.as_deref(),
        query.filters.as_deref(),
    )?;

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let count = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.count")))?;

    Ok(Json(CountResponse { count }))
}

// ===========================================================================
// POST /{object} — createRecord
// ===========================================================================

/// `POST /v1/sabcrm/records/{object}` — create a record under
/// `{ projectId, object }`. `createdAt` / `updatedAt` are set server-side
/// (RFC3339 strings).
#[instrument(skip_all, fields(object = %object))]
pub async fn create_record(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(object): Path<String>,
    Json(body): Json<CreateRecordInput>,
) -> Result<Json<RecordResponse>> {
    let project_id = require_project(&body.project_id)?;
    let data = data_to_doc(&body.data)?;

    let now = Utc::now().to_rfc3339();
    let new_oid = ObjectId::new();

    let mut new_doc = doc! {
        "_id": new_oid,
        "projectId": project_id,
        "object": &object,
        "data": data,
        "createdAt": &now,
        "updatedAt": &now,
    };
    if let Some(cb) = body.created_by.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("createdBy", cb);
    }

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.insert_one"))
    })?;

    Ok(Json(RecordResponse {
        record: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// GET /{object}/{id} — getRecord
// ===========================================================================

/// `GET /v1/sabcrm/records/{object}/{id}` — single record scoped to
/// `{ projectId, object }`. Returns `404` for ids outside the scope so we
/// don't leak existence.
#[instrument(skip_all, fields(object = %object, id = %id))]
pub async fn get_record(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((object, id)): Path<(String, String)>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<RecordResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut filter = scope(project_id, &object);
    filter.insert("_id", oid);

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let doc = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.find_one")))?
        .ok_or_else(|| ApiError::NotFound("record".to_owned()))?;

    let mut record = record_to_wire(doc);

    // ---- Optional relation/actor enrichment (?enrich=relations) ----------
    if wants_relation_enrichment(query.enrich.as_deref()) {
        let mut batch = [record];
        enrich_records(&coll, project_id, &object, &mut batch).await?;
        let [enriched] = batch;
        record = enriched;
    }

    Ok(Json(RecordResponse { record }))
}

// ===========================================================================
// PATCH /{object}/{id} — updateRecord
// ===========================================================================

/// `PATCH /v1/sabcrm/records/{object}/{id}` — partial update. Each key in
/// `data` is `$set` as `data.<key>`; `updatedAt` is always bumped. Returns
/// the updated record.
#[instrument(skip_all, fields(object = %object, id = %id))]
pub async fn update_record(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((object, id)): Path<(String, String)>,
    Json(body): Json<UpdateRecordInput>,
) -> Result<Json<RecordResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;
    let data = data_to_doc(&body.data)?;

    let mut set = Document::new();
    for (k, v) in data {
        set.insert(format!("data.{k}"), v);
    }
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let mut filter = scope(project_id, &object);
    filter.insert("_id", oid);

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let updated = coll
        .find_one_and_update(filter, doc! { "$set": set })
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.find_one_and_update"))
        })?
        .ok_or_else(|| ApiError::NotFound("record".to_owned()))?;

    Ok(Json(RecordResponse {
        record: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{object}/{id} — deleteRecord (SOFT delete / trash)
// ===========================================================================

/// `DELETE /v1/sabcrm/records/{object}/{id}` — **soft delete**. Sets the
/// top-level `deletedAt` (RFC3339) so the record is hidden from normal views
/// but recoverable via `POST /{object}/{id}/restore`; use
/// `DELETE /{object}/{id}/permanent` to hard-delete. Returns `404` if no
/// record matches `{ projectId, object, _id }`. Re-trashing an already-trashed
/// record refreshes `deletedAt` (still `{ ok: true }`).
#[instrument(skip_all, fields(object = %object, id = %id))]
pub async fn delete_record(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((object, id)): Path<(String, String)>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut filter = scope(project_id, &object);
    filter.insert("_id", oid);

    let now = Utc::now().to_rfc3339();
    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let result = coll
        .update_one(
            filter,
            doc! { "$set": { DELETED_AT: &now, "updatedAt": &now } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.soft_delete"))
        })?;

    if result.matched_count == 0 {
        return Err(ApiError::NotFound("record".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// POST /{object}/{id}/trash — trashRecord (soft delete)
// ===========================================================================

/// `POST /v1/sabcrm/records/{object}/{id}/trash` — soft-delete a record by
/// setting its top-level `deletedAt` (RFC3339, server-set) and bumping
/// `updatedAt`. Returns the (now trashed) record. `404` if no record matches
/// `{ projectId, object, _id }`. Idempotent — re-trashing refreshes `deletedAt`.
#[instrument(skip_all, fields(object = %object, id = %id))]
pub async fn trash_record(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((object, id)): Path<(String, String)>,
    Json(body): Json<crate::dto::TrashRestoreInput>,
) -> Result<Json<RecordResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut filter = scope(project_id, &object);
    filter.insert("_id", oid);

    let now = Utc::now().to_rfc3339();
    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let updated = coll
        .find_one_and_update(
            filter,
            doc! { "$set": { DELETED_AT: &now, "updatedAt": &now } },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.trash"))
        })?
        .ok_or_else(|| ApiError::NotFound("record".to_owned()))?;

    Ok(Json(RecordResponse {
        record: record_to_wire(updated),
    }))
}

// ===========================================================================
// GET /{object}/trash — listTrash
// ===========================================================================

/// `GET /v1/sabcrm/records/{object}/trash?projectId=&limit=` — list the
/// soft-deleted (trashed) records for `{ projectId, object }`, newest-deleted
/// first (sorted by `deletedAt` desc). `limit` defaults to 50, clamped at 100.
#[instrument(skip_all, fields(object = %object))]
pub async fn list_trash(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(object): Path<String>,
    Query(query): Query<crate::dto::TrashQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let limit = query
        .limit
        .filter(|l| *l > 0)
        .unwrap_or(50)
        .min(MAX_LIMIT);

    // Trashed records: `deletedAt` present and non-null.
    let mut filter = scope(project_id, &object);
    filter.insert(DELETED_AT, doc! { "$ne": Bson::Null });

    let coll = mongo.collection::<Document>(RECORDS_COLL);

    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.trash.count"))
        })?;

    let mut cursor = coll
        .find(filter)
        .sort(doc! { DELETED_AT: -1 })
        .limit(limit as i64)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.trash.find"))
        })?;

    let mut records = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.trash.cursor"))
    })? {
        records.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { records, total }))
}

// ===========================================================================
// POST /{object}/{id}/restore — restoreRecord
// ===========================================================================

/// `POST /v1/sabcrm/records/{object}/{id}/restore` — un-trash a record by
/// `$unset`-ing its top-level `deletedAt` (and bumping `updatedAt`). Returns
/// the restored record. `404` if no record matches `{ projectId, object, _id }`.
/// Idempotent — restoring a live record is a no-op that still returns it.
#[instrument(skip_all, fields(object = %object, id = %id))]
pub async fn restore_record(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((object, id)): Path<(String, String)>,
    Json(body): Json<crate::dto::TrashRestoreInput>,
) -> Result<Json<RecordResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut filter = scope(project_id, &object);
    filter.insert("_id", oid);

    let now = Utc::now().to_rfc3339();
    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let restored = coll
        .find_one_and_update(
            filter,
            doc! {
                "$unset": { DELETED_AT: "" },
                "$set": { "updatedAt": &now },
            },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.restore"))
        })?
        .ok_or_else(|| ApiError::NotFound("record".to_owned()))?;

    Ok(Json(RecordResponse {
        record: record_to_wire(restored),
    }))
}

// ===========================================================================
// DELETE /{object}/{id}/permanent — permanentDelete (hard delete)
// ===========================================================================

/// `DELETE /v1/sabcrm/records/{object}/{id}/permanent?projectId=` — **hard
/// delete** a record (live or trashed) from `{ projectId, object, _id }`.
/// Irreversible. Returns `404` if no record matches.
#[instrument(skip_all, fields(object = %object, id = %id))]
pub async fn permanent_delete_record(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((object, id)): Path<(String, String)>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut filter = scope(project_id, &object);
    filter.insert("_id", oid);

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let result = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.permanent_delete"))
    })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("record".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// POST /{object}/bulk-delete — bulkDeleteRecords
// ===========================================================================

/// Parse a slice of hex id strings into `ObjectId`s, silently dropping any
/// that fail to parse. Used by the bulk endpoints so one bad id doesn't 500
/// the whole batch.
fn parse_oids(ids: &[String]) -> Vec<ObjectId> {
    ids.iter()
        .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
        .collect()
}

/// `POST /v1/sabcrm/records/{object}/bulk-delete` — delete every record
/// matching `{ projectId, object, _id ∈ ids }`. Invalid ids are skipped
/// (no error); an empty / all-invalid id set is a no-op returning
/// `{ ok: true, deleted: 0 }`.
#[instrument(skip_all, fields(object = %object))]
pub async fn bulk_delete_records(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(object): Path<String>,
    Json(body): Json<BulkDeleteInput>,
) -> Result<Json<BulkDeleteResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oids = parse_oids(&body.ids);

    if oids.is_empty() {
        return Ok(Json(BulkDeleteResponse {
            ok: true,
            deleted: 0,
        }));
    }

    let mut filter = scope(project_id, &object);
    filter.insert("_id", doc! { "$in": oids });

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let result = coll.delete_many(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.delete_many"))
    })?;

    Ok(Json(BulkDeleteResponse {
        ok: true,
        deleted: result.deleted_count,
    }))
}

// ===========================================================================
// POST /{object}/bulk-update — bulkUpdateRecords
// ===========================================================================

/// `POST /v1/sabcrm/records/{object}/bulk-update` — `$set` each `data.<k>`
/// (and bump `updatedAt`) on every record matching
/// `{ projectId, object, _id ∈ ids }`. Invalid ids are skipped; an empty
/// id set is a no-op returning `{ ok: true, updated: 0 }`.
#[instrument(skip_all, fields(object = %object))]
pub async fn bulk_update_records(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(object): Path<String>,
    Json(body): Json<BulkUpdateInput>,
) -> Result<Json<BulkUpdateResponse>> {
    let project_id = require_project(&body.project_id)?;
    let data = data_to_doc(&body.data)?;
    let oids = parse_oids(&body.ids);

    if oids.is_empty() {
        return Ok(Json(BulkUpdateResponse {
            ok: true,
            updated: 0,
        }));
    }

    let mut set = Document::new();
    for (k, v) in data {
        set.insert(format!("data.{k}"), v);
    }
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let mut filter = scope(project_id, &object);
    filter.insert("_id", doc! { "$in": oids });

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let result = coll
        .update_many(filter, doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.update_many"))
        })?;

    Ok(Json(BulkUpdateResponse {
        ok: true,
        updated: result.modified_count,
    }))
}

// ===========================================================================
// POST /{object}/merge — mergeRecords
// ===========================================================================

/// `POST /v1/sabcrm/records/{object}/merge` — merge two records of the same
/// object into the surviving `primaryId`.
///
/// Pipeline:
/// 1. Both `primaryId` and `secondaryId` must resolve within
///    `{ projectId, object }` (else `404` — never leak existence).
/// 2. Apply the optional `data` map as `$set data.<k>` on the primary (the
///    winning field values chosen by the caller) and bump `updatedAt`.
/// 3. Re-point any activities whose `targetRecordId == secondaryId` to
///    `primaryId` (best-effort `update_many` on `sabcrm_activities`).
/// 4. Delete the `secondaryId` record.
/// 5. Return the merged primary record.
#[instrument(skip_all, fields(object = %object))]
pub async fn merge_records(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(object): Path<String>,
    Json(body): Json<MergeRecordsInput>,
) -> Result<Json<RecordResponse>> {
    let project_id = require_project(&body.project_id)?;
    let primary_oid = oid_from_str(&body.primary_id)?;
    let secondary_oid = oid_from_str(&body.secondary_id)?;

    if primary_oid == secondary_oid {
        return Err(ApiError::Validation(
            "primaryId and secondaryId must differ.".to_owned(),
        ));
    }

    let coll = mongo.collection::<Document>(RECORDS_COLL);

    // Both must exist within the tenant + object scope before we mutate.
    let mut secondary_filter = scope(project_id, &object);
    secondary_filter.insert("_id", secondary_oid);
    let secondary_exists = coll
        .find_one(secondary_filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.merge.find_secondary"))
        })?
        .is_some();
    if !secondary_exists {
        return Err(ApiError::NotFound("record".to_owned()));
    }

    // Build the `$set` for the primary: the optional winning `data` map plus a
    // fresh `updatedAt`. A non-object `data` is rejected as a `400` (via
    // `data_to_doc`'s 422? — keep parity with update: reject non-object).
    let mut set = Document::new();
    if let Some(data) = body.data.as_ref().filter(|v| !v.is_null()) {
        let data_doc = data_to_doc(data)?;
        for (k, v) in data_doc {
            set.insert(format!("data.{k}"), v);
        }
    }
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let mut primary_filter = scope(project_id, &object);
    primary_filter.insert("_id", primary_oid);

    let merged = coll
        .find_one_and_update(primary_filter, doc! { "$set": set })
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_records.merge.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("record".to_owned()))?;

    // Re-point the secondary's activities onto the surviving primary. The
    // activities collection stores `targetRecordId` as a plain hex string.
    let activities = mongo.collection::<Document>(ACTIVITIES_COLL);
    activities
        .update_many(
            doc! {
                "projectId": project_id,
                "targetRecordId": body.secondary_id.trim(),
            },
            doc! { "$set": { "targetRecordId": body.primary_id.trim() } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_records.merge.repoint_activities"),
            )
        })?;

    // Finally drop the absorbed secondary record.
    coll.delete_one(secondary_filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.merge.delete_secondary"))
    })?;

    Ok(Json(RecordResponse {
        record: record_to_wire(merged),
    }))
}

// ===========================================================================
// POST /{object}/group — groupRecords (kanban)
// ===========================================================================

/// `POST /v1/sabcrm/records/{object}/group` — group records by
/// `data.<groupByField>` for the kanban board. Each column is capped at
/// [`MAX_GROUP_RECORDS`] records.
#[instrument(skip_all, fields(object = %object))]
pub async fn group_records(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(object): Path<String>,
    Json(body): Json<GroupRecordsInput>,
) -> Result<Json<GroupResponse>> {
    let project_id = require_project(&body.project_id)?;
    let field = body.group_by_field.trim();
    if field.is_empty() {
        return Err(ApiError::Validation("groupByField is required.".to_owned()));
    }

    let group_path = format!("$data.{field}");
    let pipeline = vec![
        // Live records only — trashed records are excluded from the board.
        doc! { "$match": active_scope(project_id, &object) },
        doc! { "$sort": { "updatedAt": -1 } },
        doc! {
            "$group": {
                "_id": group_path,
                "records": { "$push": "$$ROOT" },
            }
        },
    ];

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let mut cursor = coll.aggregate(pipeline).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.aggregate(group)"))
    })?;

    let mut groups = Vec::new();
    while let Some(mut bucket) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.aggregate.cursor"))
    })? {
        let value = bucket
            .remove("_id")
            .map(sabnode_db::bson_helpers::bson_to_clean_json)
            .unwrap_or(Value::Null);

        let records = match bucket.remove("records") {
            Some(Bson::Array(arr)) => arr
                .into_iter()
                .take(MAX_GROUP_RECORDS as usize)
                .filter_map(|b| match b {
                    Bson::Document(d) => Some(record_to_wire(d)),
                    _ => None,
                })
                .collect(),
            _ => Vec::new(),
        };

        groups.push(RecordGroup { value, records });
    }

    Ok(Json(GroupResponse { groups }))
}

// ===========================================================================
// POST /{object}/aggregate — aggregateRecords
// ===========================================================================

/// Coerce a BSON aggregation result value into an `f64` metric. Numeric BSON
/// types map directly; everything else (incl. `null` from an empty bucket)
/// becomes `0.0`.
fn bson_to_f64(b: &Bson) -> f64 {
    match b {
        Bson::Int32(i) => *i as f64,
        Bson::Int64(i) => *i as f64,
        Bson::Double(d) => *d,
        _ => 0.0,
    }
}

/// `POST /v1/sabcrm/records/{object}/aggregate` — bucket records by
/// `data.<groupByField>` and reduce a `metric` over `data.<metricField>`.
///
/// Pipeline: `$match` ({@link build_list_filter} — `{ projectId, object }` +
/// the optional structured `filters`) → `$group` by `$data.<groupByField>`
/// with the metric accumulator. Returns `{ groups: [{ value, metric }], total }`
/// where `total` is the same metric reduced over ALL matched records. Buckets
/// are capped at [`MAX_AGGREGATE_GROUPS`]. Bad input (empty `groupByField`,
/// unknown `metric`, or a non-count metric without `metricField`) → `400`.
#[instrument(skip_all, fields(object = %object))]
pub async fn aggregate_records(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(object): Path<String>,
    Json(body): Json<AggregateInput>,
) -> Result<Json<AggregateResponse>> {
    let project_id = require_project(&body.project_id)?;

    let group_field = body.group_by_field.trim();
    if group_field.is_empty() {
        return Err(ApiError::BadRequest("groupByField is required.".to_owned()));
    }

    let metric = body.metric.trim().to_ascii_lowercase();
    let metric_field = body
        .metric_field
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    // Build the per-record metric expression (`$count` needs no field; the
    // rest reduce `$data.<metricField>`, which the `$group` accumulator wraps).
    if metric != "count" && metric_field.is_none() {
        return Err(ApiError::BadRequest(format!(
            "metric `{metric}` requires a `metricField`."
        )));
    }
    let metric_path = metric_field.map(|f| format!("$data.{f}"));

    // `(group accumulator, total accumulator)` for the chosen metric.
    let (group_acc, total_acc): (Bson, Bson) = match metric.as_str() {
        "count" => (
            Bson::Document(doc! { "$sum": 1 }),
            Bson::Document(doc! { "$sum": 1 }),
        ),
        "sum" => (
            Bson::Document(doc! { "$sum": &metric_path }),
            Bson::Document(doc! { "$sum": &metric_path }),
        ),
        "avg" => (
            Bson::Document(doc! { "$avg": &metric_path }),
            Bson::Document(doc! { "$avg": &metric_path }),
        ),
        "min" => (
            Bson::Document(doc! { "$min": &metric_path }),
            Bson::Document(doc! { "$min": &metric_path }),
        ),
        "max" => (
            Bson::Document(doc! { "$max": &metric_path }),
            Bson::Document(doc! { "$max": &metric_path }),
        ),
        other => {
            return Err(ApiError::BadRequest(format!(
                "unsupported metric `{other}` (expected count|sum|avg|min|max)."
            )));
        }
    };

    // Reuse the list filter builder for `{ projectId, object }` + `filters`.
    // The body carries `filters` as a JSON value; re-serialize so it flows
    // through the same `apply_filters` parser the query endpoints use.
    let filters_str = match body.filters.as_ref().filter(|v| !v.is_null()) {
        Some(v) => Some(serde_json::to_string(v).map_err(|e| {
            ApiError::BadRequest(format!("invalid `filters`: {e}"))
        })?),
        None => None,
    };
    let match_filter =
        build_list_filter(project_id, &object, None, filters_str.as_deref())?;

    let group_path = format!("$data.{group_field}");
    let pipeline = vec![
        doc! { "$match": match_filter },
        doc! {
            "$group": {
                "_id": group_path,
                "metric": group_acc,
            }
        },
        doc! { "$sort": { "_id": 1 } },
        doc! { "$limit": MAX_AGGREGATE_GROUPS },
    ];

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let mut cursor = coll.aggregate(pipeline).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.aggregate(metric)"))
    })?;

    let mut groups = Vec::new();
    while let Some(mut bucket) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.aggregate.cursor"))
    })? {
        let value = bucket
            .remove("_id")
            .map(sabnode_db::bson_helpers::bson_to_clean_json)
            .unwrap_or(Value::Null);
        let metric = bucket.get("metric").map(bson_to_f64).unwrap_or(0.0);
        groups.push(AggregateGroup { value, metric });
    }

    // Overall metric across every matched record (one extra grouped pass).
    let total_filter =
        build_list_filter(project_id, &object, None, filters_str.as_deref())?;
    let total_pipeline = vec![
        doc! { "$match": total_filter },
        doc! {
            "$group": {
                "_id": Bson::Null,
                "metric": total_acc,
            }
        },
    ];
    let mut total_cursor = coll.aggregate(total_pipeline).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.aggregate(total)"))
    })?;
    let total = match total_cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.aggregate.total.cursor"))
    })? {
        Some(doc) => doc.get("metric").map(bson_to_f64).unwrap_or(0.0),
        None => 0.0,
    };

    Ok(Json(AggregateResponse { groups, total }))
}

// ===========================================================================
// GET /{object}/distinct/{field} — distinctValues
// ===========================================================================

/// `GET /v1/sabcrm/records/{object}/distinct/{field}` — the distinct
/// `data.<field>` values within `{ projectId, object }`. Null / empty-string
/// values are dropped and the list is capped at [`MAX_DISTINCT_VALUES`].
#[instrument(skip_all, fields(object = %object, field = %field))]
pub async fn distinct_values(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((object, field)): Path<(String, String)>,
    Query(query): Query<DistinctQuery>,
) -> Result<Json<DistinctResponse>> {
    let project_id = require_project(&query.project_id)?;
    let field = field.trim();
    if field.is_empty() {
        return Err(ApiError::BadRequest("field is required.".to_owned()));
    }

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let raw = coll
        .distinct(format!("data.{field}"), active_scope(project_id, &object))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.distinct"))
        })?;

    let values: Vec<Value> = raw
        .into_iter()
        .filter(|b| !matches!(b, Bson::Null))
        .filter(|b| !matches!(b, Bson::String(s) if s.is_empty()))
        .map(sabnode_db::bson_helpers::bson_to_clean_json)
        .take(MAX_DISTINCT_VALUES)
        .collect();

    Ok(Json(DistinctResponse { values }))
}

// ===========================================================================
// GET /{object}/duplicates — findDuplicates
// ===========================================================================

/// `GET /v1/sabcrm/records/{object}/duplicates?field=<key>` — find groups of
/// records that share the same `data.<field>` value (the duplicate key) within
/// `{ projectId, object }`.
///
/// Pipeline: `$match` ({@link scope} + `data.<field>` not null) → `$group` by
/// `$data.<field>` collecting `$$ROOT` and a `$sum` count → `$match count > 1`
/// → `$limit` [`MAX_DUPLICATE_GROUPS`]. Each returned group caps its `records`
/// at [`MAX_DUPLICATE_RECORDS`] (the `count` still reflects the true total).
/// An empty / missing `field` yields a `400`.
#[instrument(skip_all, fields(object = %object, field = %query.field))]
pub async fn find_duplicates(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(object): Path<String>,
    Query(query): Query<DuplicatesQuery>,
) -> Result<Json<DuplicatesResponse>> {
    let project_id = require_project(&query.project_id)?;
    let field = query.field.trim();
    if field.is_empty() {
        return Err(ApiError::BadRequest("field is required.".to_owned()));
    }

    let mut match_filter = active_scope(project_id, &object);
    match_filter.insert(format!("data.{field}"), doc! { "$ne": Bson::Null });

    let group_path = format!("$data.{field}");
    let pipeline = vec![
        doc! { "$match": match_filter },
        doc! { "$sort": { "updatedAt": -1 } },
        doc! {
            "$group": {
                "_id": group_path,
                "records": { "$push": "$$ROOT" },
                "count": { "$sum": 1 },
            }
        },
        doc! { "$match": { "count": { "$gt": 1 } } },
        doc! { "$sort": { "count": -1 } },
        doc! { "$limit": MAX_DUPLICATE_GROUPS },
    ];

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let mut cursor = coll.aggregate(pipeline).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.aggregate(duplicates)"))
    })?;

    let mut groups = Vec::new();
    while let Some(mut bucket) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.duplicates.cursor"))
    })? {
        let value = bucket
            .remove("_id")
            .map(sabnode_db::bson_helpers::bson_to_clean_json)
            .unwrap_or(Value::Null);

        let count = bucket
            .get("count")
            .and_then(Bson::as_i64)
            .or_else(|| bucket.get("count").and_then(Bson::as_i32).map(i64::from))
            .unwrap_or(0)
            .max(0) as u64;

        let records = match bucket.remove("records") {
            Some(Bson::Array(arr)) => arr
                .into_iter()
                .take(MAX_DUPLICATE_RECORDS)
                .filter_map(|b| match b {
                    Bson::Document(d) => Some(record_to_wire(d)),
                    _ => None,
                })
                .collect(),
            _ => Vec::new(),
        };

        groups.push(DuplicateGroup {
            value,
            count,
            records,
        });
    }

    Ok(Json(DuplicatesResponse { groups }))
}

// ===========================================================================
// GET /{object}/{id}/related — recordRelations
// ===========================================================================

/// `GET /v1/sabcrm/records/{object}/{id}/related` — aggregate every related
/// record reachable from this record's RELATION fields in one call.
///
/// For the source object's metadata ([`sabcrm_core::standard_object`]), each
/// RELATION field is resolved by kind:
///
/// - **MANY_TO_ONE** — this record stores the target id in
///   `data.<fieldKey>`. If present (and a valid ObjectId), the single target
///   record is fetched from `{ projectId, object: targetObject, _id }`.
/// - **ONE_TO_MANY** — children live in `targetObject` and point back via a
///   MANY_TO_ONE field. We inspect the TARGET object's metadata for a
///   MANY_TO_ONE field whose `relation.targetObject == <this object>`, take
///   that field's key `K`, then query
///   `{ projectId, object: targetObject, data.K == <this id> }`. If no inverse
///   field exists, the relation yields an empty record set (not an error).
///
/// Unknown / custom source objects (not in the standard metadata) resolve to
/// an empty `relations` list. Each relation block is capped at
/// [`MAX_RELATION_RECORDS`].
#[instrument(skip_all, fields(object = %object, id = %id))]
pub async fn record_relations(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((object, id)): Path<(String, String)>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<RelationsResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(RECORDS_COLL);

    let meta = match sabcrm_core::standard_object(&object) {
        Some(m) => m,
        None => return Ok(Json(RelationsResponse { relations: Vec::new() })),
    };

    let mut relations = Vec::new();

    for f in &meta.fields {
        let rel = match &f.relation {
            Some(rel) => rel,
            None => continue,
        };

        let records: Vec<Value> = match rel.kind.as_str() {
            "MANY_TO_ONE" => {
                // This record stores the target id at `data.<fieldKey>`.
                let raw = doc_id_at(&coll, project_id, &object, &id, &f.key).await?;
                match raw.as_deref().filter(|s| !s.is_empty()) {
                    Some(target_id) => match oid_from_str(target_id) {
                        Ok(oid) => {
                            let mut filter = scope(project_id, &rel.target_object);
                            filter.insert("_id", oid);
                            match coll.find_one(filter).await.map_err(|e| {
                                ApiError::Internal(
                                    anyhow::Error::new(e)
                                        .context("sabcrm_records.relations.find_one"),
                                )
                            })? {
                                Some(d) => vec![record_to_wire(d)],
                                None => Vec::new(),
                            }
                        }
                        // A non-ObjectId stored value is not a fetchable id.
                        Err(_) => Vec::new(),
                    },
                    None => Vec::new(),
                }
            }
            "ONE_TO_MANY" => {
                // Children live in `targetObject`, pointing back via a
                // MANY_TO_ONE field whose target is THIS object.
                let inverse_key = sabcrm_core::standard_object(&rel.target_object)
                    .and_then(|t| {
                        t.fields.into_iter().find_map(|tf| match tf.relation {
                            Some(tr)
                                if tr.kind == "MANY_TO_ONE"
                                    && tr.target_object == object =>
                            {
                                Some(tf.key)
                            }
                            _ => None,
                        })
                    });

                match inverse_key {
                    Some(k) => {
                        let mut filter = scope(project_id, &rel.target_object);
                        filter.insert(format!("data.{k}"), &id);
                        let mut cursor = coll
                            .find(filter)
                            .limit(MAX_RELATION_RECORDS)
                            .await
                            .map_err(|e| {
                                ApiError::Internal(
                                    anyhow::Error::new(e).context("sabcrm_records.relations.find"),
                                )
                            })?;
                        let mut out = Vec::new();
                        while let Some(d) = cursor.try_next().await.map_err(|e| {
                            ApiError::Internal(
                                anyhow::Error::new(e).context("sabcrm_records.relations.cursor"),
                            )
                        })? {
                            out.push(record_to_wire(d));
                        }
                        out
                    }
                    // No inverse field → empty set, not an error.
                    None => Vec::new(),
                }
            }
            // Unknown cardinality → skip.
            _ => continue,
        };

        relations.push(RecordRelation {
            field: f.key.clone(),
            label: f.label.clone(),
            target_object: rel.target_object.clone(),
            kind: rel.kind.clone(),
            records,
        });
    }

    Ok(Json(RelationsResponse { relations }))
}

// ===========================================================================
// GET /search — searchAll (cross-object global search)
// ===========================================================================

/// Read a trimmed, non-empty string at `data.<key>` from a record's `data`
/// sub-document. Returns `None` when absent, non-string, or blank.
fn data_str<'a>(data: &'a Document, key: &str) -> Option<&'a str> {
    data.get_str(key).ok().map(str::trim).filter(|s| !s.is_empty())
}

/// Derive a human label for a matched record from its likely title field, in
/// priority order: `name` → `title` → `firstName`+`lastName` → `email`. Falls
/// back to the hex id when nothing usable is present.
fn derive_label(data: &Document, id: &str) -> String {
    if let Some(name) = data_str(data, "name") {
        return name.to_owned();
    }
    if let Some(title) = data_str(data, "title") {
        return title.to_owned();
    }
    let first = data_str(data, "firstName");
    let last = data_str(data, "lastName");
    if first.is_some() || last.is_some() {
        let joined = [first, last]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join(" ");
        if !joined.is_empty() {
            return joined;
        }
    }
    if let Some(email) = data_str(data, "email") {
        return email.to_owned();
    }
    id.to_owned()
}

/// Find the first [`SEARCH_FIELDS`] value that contains `q` (case-insensitive),
/// to surface as the hit's `snippet`. `None` when no text-ish field matches
/// (e.g. the match was on a field not stored as a plain string).
fn derive_snippet(data: &Document, needle_lower: &str) -> Option<String> {
    for field in SEARCH_FIELDS {
        if let Some(val) = data_str(data, field) {
            if val.to_lowercase().contains(needle_lower) {
                return Some(val.to_owned());
            }
        }
    }
    None
}

/// `GET /v1/sabcrm/records/search?projectId=&q=&limit=` — **cross-object**
/// global search. Unlike the per-object endpoints this is NOT scoped to a
/// single `{object}`: it matches `q` (case-insensitive regex) against the
/// common text-ish [`SEARCH_FIELDS`] of `data.*` across EVERY object in
/// `projectId`, excluding trashed records.
///
/// Returns `{ hits: [{ object, id, label, snippet? }] }` capped at
/// [`MAX_SEARCH_HITS`]. `label` is derived from the record's likely title
/// field (name / title / firstName+lastName / email); `snippet` is the first
/// matched text-ish field. An empty / missing `q` yields no hits.
#[instrument(skip_all)]
pub async fn search_all(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<SearchResponse>> {
    let project_id = require_project(&query.project_id)?;

    let needle = match query.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(q) => q,
        None => return Ok(Json(SearchResponse { hits: Vec::new() })),
    };
    let needle_lower = needle.to_lowercase();

    let limit = query
        .limit
        .filter(|l| *l > 0)
        .map(|l| l as i64)
        .unwrap_or(MAX_SEARCH_HITS)
        .min(MAX_SEARCH_HITS);

    // Cross-object scope: `{ projectId }` + not-trashed, with the free-text
    // `$or` regex over the common search fields (NOT scoped to one object).
    let mut filter = doc! { "projectId": project_id };
    let (k, v) = not_trashed();
    filter.insert(k, v);

    let ors: Vec<Bson> = SEARCH_FIELDS
        .iter()
        .map(|field| {
            Bson::Document(doc! {
                format!("data.{field}"): { "$regex": needle, "$options": "i" }
            })
        })
        .collect();
    filter.insert("$or", Bson::Array(ors));

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "updatedAt": -1 })
        .limit(limit)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.search.find"))
        })?;

    let mut hits = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.search.cursor"))
    })? {
        let id = d
            .get_object_id("_id")
            .map(|o| o.to_hex())
            .unwrap_or_default();
        let object = d.get_str("object").unwrap_or_default().to_owned();
        let data = d.get_document("data").ok();

        let (label, snippet) = match data {
            Some(data) => (derive_label(data, &id), derive_snippet(data, &needle_lower)),
            None => (id.clone(), None),
        };

        hits.push(SearchHit {
            object,
            id,
            label,
            snippet,
        });
    }

    Ok(Json(SearchResponse { hits }))
}

/// Fetch the string value stored at `data.<field_key>` for the source record
/// `{ projectId, object, _id }`. Returns `None` when the record or field is
/// missing or the value is not a string.
async fn doc_id_at(
    coll: &mongodb::Collection<Document>,
    project_id: &str,
    object: &str,
    id: &str,
    field_key: &str,
) -> Result<Option<String>> {
    let oid = oid_from_str(id)?;
    let mut filter = scope(project_id, object);
    filter.insert("_id", oid);

    let doc = coll.find_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.relations.source"))
    })?;

    Ok(doc
        .and_then(|d| d.get_document("data").ok().cloned())
        .and_then(|data| data.get_str(field_key).ok().map(str::to_owned)))
}
