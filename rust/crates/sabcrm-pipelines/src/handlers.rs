//! HTTP handlers for the SabCRM sales-pipelines domain.
//!
//! CRUD over the `sabcrm_pipelines` Mongo collection.
//!
//! | Endpoint                                  | TS action        |
//! |-------------------------------------------|------------------|
//! | `GET    /v1/sabcrm/pipelines`             | `listPipelines`  |
//! | `GET    /v1/sabcrm/pipelines/{id}`        | `getPipeline`    |
//! | `POST   /v1/sabcrm/pipelines`             | `createPipeline` |
//! | `PATCH  /v1/sabcrm/pipelines/{id}`        | `updatePipeline` |
//! | `DELETE /v1/sabcrm/pipelines/{id}`        | `deletePipeline` |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus `_id`
//! as appropriate) — **not** `userId`. Every handler requires the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor so the surface is never
//! anonymously open.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Array, Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreatePipelineInput, ListQuery, ListResponse, OkResponse, PipelineResponse, ScopeQuery,
    UpdatePipelineInput,
};

/// The Mongo collection backing sales pipelines.
const PIPELINES_COLL: &str = "sabcrm_pipelines";

/// Default target object for a pipeline when none is supplied.
const DEFAULT_OBJECT: &str = "opportunities";

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
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.payload.to_bson"))
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
// GET / — listPipelines
// ===========================================================================

/// `GET /v1/sabcrm/pipelines` — list the pipelines for one project, scoped
/// by `{ projectId }`, ordered by `createdAt`.
#[instrument(skip_all)]
pub async fn list_pipelines(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(PIPELINES_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id })
        .sort(doc! { "createdAt": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.find")))?;

    let mut pipelines = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.cursor"))
    })? {
        pipelines.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { pipelines }))
}

// ===========================================================================
// GET /{id} — getPipeline
// ===========================================================================

/// `GET /v1/sabcrm/pipelines/{id}` — fetch a single pipeline scoped by
/// `{ projectId, _id }`. `404` if no pipeline matches.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_pipeline(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<PipelineResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(PIPELINES_COLL);
    let found = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pipeline".to_owned()))?;

    Ok(Json(PipelineResponse {
        pipeline: record_to_wire(found),
    }))
}

// ===========================================================================
// POST / — createPipeline
// ===========================================================================

/// `POST /v1/sabcrm/pipelines` — create a pipeline. `object` defaults to
/// `"opportunities"`, `stages` defaults to `[]`; `createdAt` / `updatedAt`
/// are set server-side (RFC3339).
#[instrument(skip_all)]
pub async fn create_pipeline(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreatePipelineInput>,
) -> Result<Json<PipelineResponse>> {
    let project_id = require_project(&body.project_id)?;

    let mut new_doc = payload_to_set(&body.pipeline)?;

    // Default `object` to "opportunities" when absent / blank.
    let needs_object = match new_doc.get("object") {
        Some(Bson::String(s)) => s.trim().is_empty(),
        _ => true,
    };
    if needs_object {
        new_doc.insert("object", DEFAULT_OBJECT);
    }

    // Default `stages` to [] when absent.
    if !new_doc.contains_key("stages") {
        new_doc.insert("stages", Array::new());
    }

    let now = Utc::now().to_rfc3339();
    new_doc.insert("_id", ObjectId::new());
    new_doc.insert("projectId", project_id);
    new_doc.insert("createdAt", &now);
    new_doc.insert("updatedAt", &now);

    let coll = mongo.collection::<Document>(PIPELINES_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.insert_one"))
    })?;

    Ok(Json(PipelineResponse {
        pipeline: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — updatePipeline
// ===========================================================================

/// `PATCH /v1/sabcrm/pipelines/{id}` — partial update. Each key in the
/// flattened body (minus `projectId`) is `$set` verbatim; `updatedAt` is
/// always bumped. Returns the updated pipeline.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_pipeline(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdatePipelineInput>,
) -> Result<Json<PipelineResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut set = payload_to_set(&body.patch)?;
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(PIPELINES_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_pipelines.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("pipeline".to_owned()))?;

    Ok(Json(PipelineResponse {
        pipeline: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — deletePipeline
// ===========================================================================

/// `DELETE /v1/sabcrm/pipelines/{id}` — scoped delete. Returns `404` if no
/// pipeline matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_pipeline(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(PIPELINES_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("pipeline".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}
