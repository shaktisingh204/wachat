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
    CreateRecordInput, GroupRecordsInput, GroupResponse, ListQuery, ListResponse, OkResponse,
    RecordGroup, RecordRelation, RecordResponse, RelationsResponse, ScopeQuery, UpdateRecordInput,
};

/// The single Mongo collection backing every SabCRM object.
const RECORDS_COLL: &str = "sabcrm_records";

/// Default page size for the list endpoint when no `limit` is supplied.
const DEFAULT_LIMIT: u64 = 20;
/// Hard cap on `limit` per slice contract.
const MAX_LIMIT: u64 = 100;
/// Hard cap on records returned per kanban column.
const MAX_GROUP_RECORDS: i64 = 100;
/// Hard cap on records returned per relation block.
const MAX_RELATION_RECORDS: i64 = 50;

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

/// Base tenant filter shared by every query: `{ projectId, object }`.
fn scope(project_id: &str, object: &str) -> Document {
    doc! { "projectId": project_id, "object": object }
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

/// Parse the optional URL-encoded JSON `filters` query param and AND each
/// `{ "<fieldKey>": <condition> }` entry into the supplied Mongo `filter`
/// as `data.<fieldKey> <predicate>`. Bad JSON or an unsupported op yields a
/// `400`; an absent / empty param is a no-op.
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

    // ---- Filter --------------------------------------------------------
    let mut filter = scope(project_id, &object);

    if let Some(q) = query.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
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

    // ---- Structured field filters -------------------------------------
    apply_filters(&mut filter, query.filters.as_deref())?;

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

    Ok(Json(ListResponse { records, total }))
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

    Ok(Json(RecordResponse {
        record: record_to_wire(doc),
    }))
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
// DELETE /{object}/{id} — deleteRecord
// ===========================================================================

/// `DELETE /v1/sabcrm/records/{object}/{id}` — scoped delete. Returns
/// `404` if no record matches `{ projectId, object, _id }`.
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

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let result = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.delete_one"))
    })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("record".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
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
        doc! { "$match": scope(project_id, &object) },
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
