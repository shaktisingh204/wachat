//! HTTP handlers for the SabCRM saved-views domain.
//!
//! CRUD over the `sabcrm_views` Mongo collection.
//!
//! | Endpoint                                  | TS source (`views.server.ts`) |
//! |-------------------------------------------|-------------------------------|
//! | `GET    /v1/sabcrm/views`                 | `listViews`                   |
//! | `POST   /v1/sabcrm/views`                 | `createView`                  |
//! | `PATCH  /v1/sabcrm/views/{id}`            | `updateView`                  |
//! | `DELETE /v1/sabcrm/views/{id}`            | `deleteView`                  |
//! | `POST   /v1/sabcrm/views/{id}/default`    | `setDefaultView`              |
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
    CreateViewInput, ListQuery, ListResponse, OkResponse, RunViewInput, RunViewResponse,
    ScopeQuery, SetDefaultInput, UpdateViewInput, ViewResponse,
};

/// The Mongo collection backing saved views.
const VIEWS_COLL: &str = "sabcrm_views";

/// The single Mongo collection backing every SabCRM object's records.
const RECORDS_COLL: &str = "sabcrm_records";

/// Default page size for `run_view` when no `limit` is supplied.
const RUN_DEFAULT_LIMIT: u64 = 50;
/// Hard cap on `run_view`'s `limit`.
const RUN_MAX_LIMIT: u64 = 100;

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
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_views.payload.to_bson"))
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
// GET / — listViews
// ===========================================================================

/// `GET /v1/sabcrm/views` — list the views for one object, scoped by
/// `{ projectId, object }`.
#[instrument(skip_all)]
pub async fn list_views(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;
    let object = query.object.trim();
    if object.is_empty() {
        return Err(ApiError::Validation("object is required.".to_owned()));
    }

    let coll = mongo.collection::<Document>(VIEWS_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id, "object": object })
        .sort(doc! { "createdAt": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_views.find")))?;

    let mut views = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_views.cursor"))
    })? {
        views.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { views }))
}

// ===========================================================================
// POST / — createView
// ===========================================================================

/// `POST /v1/sabcrm/views` — create a saved view. `createdAt` /
/// `updatedAt` are set server-side (RFC3339).
#[instrument(skip_all)]
pub async fn create_view(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateViewInput>,
) -> Result<Json<ViewResponse>> {
    let project_id = require_project(&body.project_id)?;

    let mut new_doc = payload_to_set(&body.view)?;
    let now = Utc::now().to_rfc3339();
    new_doc.insert("_id", ObjectId::new());
    new_doc.insert("projectId", project_id);
    new_doc.insert("createdAt", &now);
    new_doc.insert("updatedAt", &now);

    let coll = mongo.collection::<Document>(VIEWS_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_views.insert_one"))
    })?;

    Ok(Json(ViewResponse {
        view: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — updateView
// ===========================================================================

/// `PATCH /v1/sabcrm/views/{id}` — partial update. Each key in the
/// flattened body (minus `projectId`) is `$set` verbatim; `updatedAt` is
/// always bumped. Returns the updated view.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_view(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateViewInput>,
) -> Result<Json<ViewResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut set = payload_to_set(&body.patch)?;
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(VIEWS_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_views.find_one_and_update"))
        })?
        .ok_or_else(|| ApiError::NotFound("view".to_owned()))?;

    Ok(Json(ViewResponse {
        view: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — deleteView
// ===========================================================================

/// `DELETE /v1/sabcrm/views/{id}` — scoped delete. Returns `404` if no
/// view matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_view(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(VIEWS_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_views.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("view".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// POST /{id}/default — setDefaultView
// ===========================================================================

/// `POST /v1/sabcrm/views/{id}/default` — make this view the default for
/// its object: unset `isDefault` on every sibling view of the same object,
/// then set it on this one. Returns the updated view.
#[instrument(skip_all, fields(id = %id))]
pub async fn set_default_view(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<SetDefaultInput>,
) -> Result<Json<ViewResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(VIEWS_COLL);

    // Resolve the target view first so we know its `object`.
    let target = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_views.find_one")))?
        .ok_or_else(|| ApiError::NotFound("view".to_owned()))?;

    let object = target
        .get_str("object")
        .map_err(|_| ApiError::Validation("view is missing `object`.".to_owned()))?
        .to_owned();

    let now = Utc::now().to_rfc3339();

    // Unset isDefault on every sibling of the same object.
    coll.update_many(
        doc! { "projectId": project_id, "object": &object },
        doc! { "$set": { "isDefault": false, "updatedAt": &now } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_views.update_many(unset)"))
    })?;

    // Set isDefault on this view.
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": { "isDefault": true, "updatedAt": &now } },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_views.find_one_and_update(default)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("view".to_owned()))?;

    Ok(Json(ViewResponse {
        view: record_to_wire(updated),
    }))
}

// ===========================================================================
// POST /{id}/run — runView
// ===========================================================================

/// Resolve the equality operand from one persisted view-filter entry. A bare
/// scalar is used verbatim; an object `{ "value": <v>, ... }` (the structured
/// `{ op, value }` shape) contributes its `value`. Persisted view filters are
/// applied as equality only — `op` is ignored.
fn view_filter_operand(cond: &Value) -> Option<&Value> {
    match cond {
        Value::Object(map) => map.get("value"),
        scalar => Some(scalar),
    }
}

/// AND each `{ "<fieldKey>": <condition> }` entry of a persisted view's
/// `filters` into the supplied Mongo `filter` as an equality on
/// `data.<fieldKey>`. A non-object `filters` (or absent) is a no-op; bad
/// operands surface as a `400`.
fn apply_view_filters(filter: &mut Document, filters: Option<&Value>) -> Result<()> {
    let map = match filters {
        Some(Value::Object(map)) => map,
        _ => return Ok(()),
    };

    for (field, cond) in map {
        let key = field.trim();
        if key.is_empty() {
            continue;
        }
        let operand = match view_filter_operand(cond) {
            Some(v) if !v.is_null() => v,
            _ => continue,
        };
        let bson = bson::to_bson(operand)
            .map_err(|e| ApiError::BadRequest(format!("invalid view filter value: {e}")))?;
        filter.insert(format!("data.{key}"), bson);
    }

    Ok(())
}

/// `POST /v1/sabcrm/views/{id}/run` — load the saved view by `{ projectId,
/// _id }` (404 if missing), then query `sabcrm_records` scoped by
/// `{ projectId, object: view.object }` with the view's `filters` applied as
/// equalities, sorted by `data.<view.sortBy>` (else top-level `updatedAt`) in
/// `view.sortDir` (default `desc`), paginated. Returns `{ records, total }`
/// in the records list wire shape.
#[instrument(skip_all, fields(id = %id))]
pub async fn run_view(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<RunViewInput>,
) -> Result<Json<RunViewResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    // ---- Load the view -------------------------------------------------
    let views = mongo.collection::<Document>(VIEWS_COLL);
    let view = views
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_views.find_one")))?
        .ok_or_else(|| ApiError::NotFound("view".to_owned()))?;

    let object = view
        .get_str("object")
        .map_err(|_| ApiError::Validation("view is missing `object`.".to_owned()))?
        .to_owned();

    // ---- Pagination ----------------------------------------------------
    let page = body.page.filter(|p| *p > 0).unwrap_or(1);
    let limit = body
        .limit
        .filter(|l| *l > 0)
        .unwrap_or(RUN_DEFAULT_LIMIT)
        .min(RUN_MAX_LIMIT);
    let skip = (page - 1).saturating_mul(limit);

    // ---- Filter --------------------------------------------------------
    let mut filter = doc! { "projectId": project_id, "object": &object };
    let filters_json: Option<Value> = view
        .get("filters")
        .map(|b| sabnode_db::bson_helpers::bson_to_clean_json(b.clone()));
    apply_view_filters(&mut filter, filters_json.as_ref())?;

    // ---- Sort ----------------------------------------------------------
    let sort_dir = match view.get_str("sortDir").ok().map(str::trim) {
        Some("asc") => 1,
        _ => -1, // default desc
    };
    let sort_key = match view
        .get_str("sortBy")
        .ok()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(key) => format!("data.{key}"),
        None => "updatedAt".to_owned(),
    };

    // ---- Query records -------------------------------------------------
    let records_coll = mongo.collection::<Document>(RECORDS_COLL);

    let total = records_coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_views.run.count")))?;

    let mut cursor = records_coll
        .find(filter)
        .sort(doc! { sort_key: sort_dir })
        .skip(skip)
        .limit(limit as i64)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_views.run.find")))?;

    let mut records = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_views.run.cursor"))
    })? {
        records.push(record_to_wire(d));
    }

    Ok(Json(RunViewResponse { records, total }))
}
