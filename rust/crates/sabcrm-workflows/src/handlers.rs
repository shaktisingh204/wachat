//! HTTP handlers for the SabCRM automation-workflows domain.
//!
//! CRUD over the `sabcrm_workflows` Mongo collection.
//!
//! | Endpoint                                | Action            |
//! |-----------------------------------------|-------------------|
//! | `GET    /v1/sabcrm/workflows`           | `listWorkflows`   |
//! | `POST   /v1/sabcrm/workflows`           | `createWorkflow`  |
//! | `GET    /v1/sabcrm/workflows/{id}`      | `getWorkflow`     |
//! | `PATCH  /v1/sabcrm/workflows/{id}`      | `updateWorkflow`  |
//! | `DELETE /v1/sabcrm/workflows/{id}`      | `deleteWorkflow`  |
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
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateWorkflowInput, ListQuery, ListResponse, OkResponse, ScopeQuery, UpdateWorkflowInput,
    WorkflowResponse,
};

/// The Mongo collection backing automation workflows.
const WORKFLOWS_COLL: &str = "sabcrm_workflows";

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
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_workflows.payload.to_bson"))
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

/// Convert an arbitrary JSON value into a BSON value for direct `$set`.
fn json_to_bson(value: &Value, ctx: &'static str) -> Result<Bson> {
    bson::to_bson(value).map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(ctx)))
}

// ===========================================================================
// GET / — listWorkflows
// ===========================================================================

/// `GET /v1/sabcrm/workflows` — list the workflows for one project, scoped
/// by `{ projectId }`, newest first.
#[instrument(skip_all)]
pub async fn list_workflows(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(WORKFLOWS_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_workflows.find"))
        })?;

    let mut workflows = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_workflows.cursor"))
    })? {
        workflows.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { workflows }))
}

// ===========================================================================
// GET /{id} — getWorkflow
// ===========================================================================

/// `GET /v1/sabcrm/workflows/{id}` — fetch one workflow scoped by
/// `{ projectId, _id }`. `404` when no match.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_workflow(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<WorkflowResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(WORKFLOWS_COLL);
    let found = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_workflows.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("workflow".to_owned()))?;

    Ok(Json(WorkflowResponse {
        workflow: record_to_wire(found),
    }))
}

// ===========================================================================
// POST / — createWorkflow
// ===========================================================================

/// `POST /v1/sabcrm/workflows` — create a workflow. `name` is required;
/// `trigger` is stored verbatim; `steps` defaults to `[]`; `enabled`
/// defaults to `false`. `createdAt` / `updatedAt` are set server-side
/// (RFC3339).
#[instrument(skip_all)]
pub async fn create_workflow(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateWorkflowInput>,
) -> Result<Json<WorkflowResponse>> {
    let project_id = require_project(&body.project_id)?;

    let name = body.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }

    let trigger = json_to_bson(&body.trigger, "sabcrm_workflows.trigger.to_bson")?;
    let steps = match body.steps {
        Some(ref v) => json_to_bson(v, "sabcrm_workflows.steps.to_bson")?,
        None => Bson::Array(Vec::new()),
    };

    let now = Utc::now().to_rfc3339();
    let mut new_doc = Document::new();
    new_doc.insert("_id", ObjectId::new());
    new_doc.insert("projectId", project_id);
    new_doc.insert("name", name);
    if let Some(desc) = body.description.as_deref() {
        new_doc.insert("description", desc);
    }
    new_doc.insert("enabled", body.enabled.unwrap_or(false));
    new_doc.insert("trigger", trigger);
    new_doc.insert("steps", steps);
    new_doc.insert("createdAt", &now);
    new_doc.insert("updatedAt", &now);

    let coll = mongo.collection::<Document>(WORKFLOWS_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_workflows.insert_one"))
    })?;

    Ok(Json(WorkflowResponse {
        workflow: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — updateWorkflow
// ===========================================================================

/// `PATCH /v1/sabcrm/workflows/{id}` — partial update. Each key in the
/// flattened body (minus `projectId` / `_id`) is `$set` verbatim;
/// `updatedAt` is always bumped. Covers enable/disable, trigger swaps and
/// step edits. Returns the updated workflow.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_workflow(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateWorkflowInput>,
) -> Result<Json<WorkflowResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut set = payload_to_set(&body.patch)?;
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(WORKFLOWS_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_workflows.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("workflow".to_owned()))?;

    Ok(Json(WorkflowResponse {
        workflow: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — deleteWorkflow
// ===========================================================================

/// `DELETE /v1/sabcrm/workflows/{id}` — scoped delete. Returns `404` if no
/// workflow matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_workflow(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(WORKFLOWS_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_workflows.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("workflow".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}
