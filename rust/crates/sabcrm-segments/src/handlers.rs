//! HTTP handlers for the SabCRM saved-segments (smart lists) domain.
//!
//! CRUD over the `sabcrm_segments` Mongo collection.
//!
//! | Endpoint                              | Action          |
//! |---------------------------------------|-----------------|
//! | `GET    /v1/sabcrm/segments`          | `listSegments`  |
//! | `POST   /v1/sabcrm/segments`          | `createSegment` |
//! | `GET    /v1/sabcrm/segments/{id}`     | `getSegment`    |
//! | `PATCH  /v1/sabcrm/segments/{id}`     | `updateSegment` |
//! | `DELETE /v1/sabcrm/segments/{id}`     | `deleteSegment` |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus
//! `_id` / `object` as appropriate) — **not** `userId`. Every handler
//! requires the [`AuthUser`](sabnode_auth::AuthUser) extractor so the
//! surface is never anonymously open.

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
    ApplySegmentInput, ApplySegmentResponse, CreateSegmentInput, ListQuery, ListResponse,
    OkResponse, ScopeQuery, SegmentResponse, UpdateSegmentInput,
};
use crate::filter::{merge_node_into_filter, parse_filter};

/// The Mongo collection backing saved segments.
const SEGMENTS_COLL: &str = "sabcrm_segments";

/// The records collection a segment's filter is applied against by
/// `POST /{id}/apply`.
const RECORDS_COLL: &str = "sabcrm_records";

/// Default page size for `apply_segment` when no `limit` is supplied.
const APPLY_DEFAULT_LIMIT: u64 = 50;
/// Hard cap on `apply_segment`'s `limit`.
const APPLY_MAX_LIMIT: u64 = 100;

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
/// dropping `_id` / `projectId` so callers cannot rewrite tenancy keys.
fn payload_to_set(value: &Value) -> Result<Document> {
    let bson = bson::to_bson(value).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_segments.payload.to_bson"))
    })?;
    let doc = match bson {
        Bson::Document(d) => d,
        _ => return Err(ApiError::Validation("body must be an object.".to_owned())),
    };
    let mut out = Document::new();
    for (k, v) in doc {
        if matches!(k.as_str(), "_id" | "projectId") {
            continue;
        }
        out.insert(k, v);
    }
    Ok(out)
}

// ===========================================================================
// GET / — listSegments
// ===========================================================================

/// `GET /v1/sabcrm/segments` — list the segments, scoped by `{ projectId }`
/// and optionally narrowed by `object`.
#[instrument(skip_all)]
pub async fn list_segments(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let mut filter = doc! { "projectId": project_id };
    if let Some(object) = query.object.as_deref().map(str::trim) {
        if !object.is_empty() {
            filter.insert("object", object);
        }
    }

    let coll = mongo.collection::<Document>(SEGMENTS_COLL);
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_segments.find")))?;

    let mut segments = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_segments.cursor"))
    })? {
        segments.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { segments }))
}

// ===========================================================================
// GET /{id} — getSegment
// ===========================================================================

/// `GET /v1/sabcrm/segments/{id}` — fetch one segment by `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_segment(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<SegmentResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(SEGMENTS_COLL);
    let segment = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_segments.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("segment".to_owned()))?;

    Ok(Json(SegmentResponse {
        segment: record_to_wire(segment),
    }))
}

// ===========================================================================
// POST / — createSegment
// ===========================================================================

/// `POST /v1/sabcrm/segments` — create a saved segment. `createdAt` /
/// `updatedAt` are set server-side (RFC3339).
#[instrument(skip_all)]
pub async fn create_segment(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateSegmentInput>,
) -> Result<Json<SegmentResponse>> {
    let project_id = require_project(&body.project_id)?;

    let mut new_doc = payload_to_set(&body.segment)?;
    let now = Utc::now().to_rfc3339();
    new_doc.insert("_id", ObjectId::new());
    new_doc.insert("projectId", project_id);
    new_doc.insert("createdAt", &now);
    new_doc.insert("updatedAt", &now);

    let coll = mongo.collection::<Document>(SEGMENTS_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_segments.insert_one"))
    })?;

    Ok(Json(SegmentResponse {
        segment: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — updateSegment
// ===========================================================================

/// `PATCH /v1/sabcrm/segments/{id}` — partial update. Each key in the
/// flattened body (minus `projectId`) is `$set` verbatim; `updatedAt` is
/// always bumped. Returns the updated segment.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_segment(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSegmentInput>,
) -> Result<Json<SegmentResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut set = payload_to_set(&body.patch)?;
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(SEGMENTS_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_segments.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("segment".to_owned()))?;

    Ok(Json(SegmentResponse {
        segment: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — deleteSegment
// ===========================================================================

/// `DELETE /v1/sabcrm/segments/{id}` — scoped delete. Returns `404` if no
/// segment matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_segment(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(SEGMENTS_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_segments.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("segment".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// POST /{id}/apply — applySegment
// ===========================================================================

/// Build the Mongo sort document for `apply_segment`. Prefers the request's
/// `sortBy` / `sortDir` override, falling back to the segment's stored
/// `sortBy` / `sortDir`, then to top-level `updatedAt` desc. `sortBy` is the
/// `createdAt` / `updatedAt` audit column or a `data.<key>` field.
fn build_apply_sort(segment: &Document, body: &ApplySegmentInput) -> Document {
    let sort_by = body
        .sort_by
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .or_else(|| {
            segment
                .get_str("sortBy")
                .ok()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_owned)
        });

    let dir_str = body
        .sort_dir
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .or_else(|| {
            segment
                .get_str("sortDir")
                .ok()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_owned)
        });
    let dir = match dir_str.as_deref() {
        Some("asc") => 1,
        _ => -1,
    };

    match sort_by {
        Some(key) if key == "createdAt" || key == "updatedAt" => doc! { key: dir },
        Some(key) => doc! { format!("data.{key}"): dir },
        None => doc! { "updatedAt": -1 },
    }
}

/// `POST /v1/sabcrm/segments/{id}/apply` — load the saved segment by
/// `{ projectId, _id }` (404 if missing), translate its stored records-filter
/// AST (the `filters` key — see [`crate::filter`]) to a Mongo predicate scoped
/// by `{ projectId, object: segment.object }`, AND any inline adhoc `filter`
/// AST on top, then page the matching `sabcrm_records`. Returns
/// `{ records, total }` in the records list wire shape (`_id` → `id`).
#[instrument(skip_all, fields(id = %id))]
pub async fn apply_segment(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<ApplySegmentInput>,
) -> Result<Json<ApplySegmentResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    // ---- Load the segment ----------------------------------------------
    let segments = mongo.collection::<Document>(SEGMENTS_COLL);
    let segment = segments
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_segments.apply.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("segment".to_owned()))?;

    let object = segment
        .get_str("object")
        .map_err(|_| ApiError::Validation("segment is missing `object`.".to_owned()))?
        .to_owned();

    // ---- Pagination ----------------------------------------------------
    let page = body.page.filter(|p| *p > 0).unwrap_or(1);
    let limit = body
        .limit
        .filter(|l| *l > 0)
        .unwrap_or(APPLY_DEFAULT_LIMIT)
        .min(APPLY_MAX_LIMIT);
    let skip = (page - 1).saturating_mul(limit);

    // ---- Filter: tenant scope + stored AST + optional adhoc AST --------
    let mut filter = doc! { "projectId": project_id, "object": &object };

    let stored_filter: Option<Value> = segment
        .get("filters")
        .map(|b| sabnode_db::bson_helpers::bson_to_clean_json(b.clone()));
    let stored_node = parse_filter(stored_filter.as_ref())?;
    merge_node_into_filter(&mut filter, stored_node.as_ref())?;

    let adhoc_node = parse_filter(body.filter.as_ref())?;
    merge_node_into_filter(&mut filter, adhoc_node.as_ref())?;

    // ---- Sort ----------------------------------------------------------
    let sort_doc = build_apply_sort(&segment, &body);

    // ---- Query records -------------------------------------------------
    let records_coll = mongo.collection::<Document>(RECORDS_COLL);

    let total = records_coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_segments.apply.count"))
        })?;

    let mut cursor = records_coll
        .find(filter)
        .sort(sort_doc)
        .skip(skip)
        .limit(limit as i64)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_segments.apply.find"))
        })?;

    let mut records = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_segments.apply.cursor"))
    })? {
        records.push(record_to_wire(d));
    }

    Ok(Json(ApplySegmentResponse { records, total }))
}
