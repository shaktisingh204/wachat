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
    CreateViewInput, ListQuery, ListResponse, OkResponse, ScopeQuery, SetDefaultInput,
    UpdateViewInput, ViewResponse,
};

/// The Mongo collection backing saved views.
const VIEWS_COLL: &str = "sabcrm_views";

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
