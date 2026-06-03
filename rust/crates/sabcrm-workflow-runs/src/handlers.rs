//! HTTP handlers for the SabCRM workflow-runs domain.
//!
//! Durable run history + per-step status over the `sabcrm_workflow_runs`
//! Mongo collection.
//!
//! | Endpoint                                       | Action            |
//! |------------------------------------------------|-------------------|
//! | `GET    /v1/sabcrm/workflow-runs`              | list (newest)     |
//! | `POST   /v1/sabcrm/workflow-runs`              | create            |
//! | `GET    /v1/sabcrm/workflow-runs/{id}`         | get one           |
//! | `PATCH  /v1/sabcrm/workflow-runs/{id}`         | update            |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus
//! `_id` / `workflowId` as appropriate) — **not** `userId`. Every handler
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
    CreateRunInput, ListQuery, ListResponse, RunResponse, ScopeQuery, UpdateRunInput,
};

/// The Mongo collection backing workflow runs.
const RUNS_COLL: &str = "sabcrm_workflow_runs";

/// Default page size for `list_runs` when no `limit` is supplied.
const LIST_DEFAULT_LIMIT: u64 = 50;
/// Hard cap on `list_runs`'s `limit`.
const LIST_MAX_LIMIT: u64 = 200;

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
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_workflow_runs.payload.to_bson"))
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
// GET / — list runs (newest first)
// ===========================================================================

/// `GET /v1/sabcrm/workflow-runs` — list runs scoped by `{ projectId }`
/// (and `workflowId` when supplied), newest first by `createdAt`, capped
/// by `limit` (default 50, max 200).
#[instrument(skip_all)]
pub async fn list_runs(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let mut filter = doc! { "projectId": project_id };
    if let Some(workflow_id) = query.workflow_id.as_deref().map(str::trim) {
        if !workflow_id.is_empty() {
            filter.insert("workflowId", workflow_id);
        }
    }

    let limit = query
        .limit
        .filter(|l| *l > 0)
        .unwrap_or(LIST_DEFAULT_LIMIT)
        .min(LIST_MAX_LIMIT);

    let coll = mongo.collection::<Document>(RUNS_COLL);
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(limit as i64)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_workflow_runs.find"))
        })?;

    let mut runs = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_workflow_runs.cursor"))
    })? {
        runs.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { runs }))
}

// ===========================================================================
// GET /{id} — get one run
// ===========================================================================

/// `GET /v1/sabcrm/workflow-runs/{id}` — fetch one run scoped by
/// `{ projectId, _id }`. Returns `404` if no run matches.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_run(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<RunResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(RUNS_COLL);
    let found = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_workflow_runs.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("workflow run".to_owned()))?;

    Ok(Json(RunResponse {
        run: record_to_wire(found),
    }))
}

// ===========================================================================
// POST / — create a run
// ===========================================================================

/// `POST /v1/sabcrm/workflow-runs` — create a workflow run. `workflowId`
/// is required. `status` defaults to `running` when absent; `startedAt` /
/// `createdAt` are set server-side (RFC3339). Returns the new run.
#[instrument(skip_all)]
pub async fn create_run(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateRunInput>,
) -> Result<Json<RunResponse>> {
    let project_id = require_project(&body.project_id)?;

    let mut new_doc = payload_to_set(&body.run)?;

    // workflowId is mandatory.
    let has_workflow = new_doc
        .get_str("workflowId")
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    if !has_workflow {
        return Err(ApiError::Validation("workflowId is required.".to_owned()));
    }

    let now = Utc::now().to_rfc3339();
    new_doc.insert("_id", ObjectId::new());
    new_doc.insert("projectId", project_id);

    // Default status → "running" when not provided.
    if new_doc
        .get_str("status")
        .map(|s| s.trim().is_empty())
        .unwrap_or(true)
    {
        new_doc.insert("status", "running");
    }

    // Default steps → [] when not provided.
    if !new_doc.contains_key("steps") {
        new_doc.insert("steps", Bson::Array(Vec::new()));
    }

    new_doc.insert("startedAt", &now);
    new_doc.insert("createdAt", &now);

    let coll = mongo.collection::<Document>(RUNS_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_workflow_runs.insert_one"))
    })?;

    Ok(Json(RunResponse {
        run: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — update a run
// ===========================================================================

/// `PATCH /v1/sabcrm/workflow-runs/{id}` — partial update. Each key in the
/// flattened body (minus `projectId` / `_id`) is `$set` verbatim; commonly
/// used to flip `status`, replace `steps`, or stamp `finishedAt`.
/// `updatedAt` is always bumped. Returns the updated run.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_run(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateRunInput>,
) -> Result<Json<RunResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut set = payload_to_set(&body.patch)?;
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(RUNS_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_workflow_runs.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("workflow run".to_owned()))?;

    Ok(Json(RunResponse {
        run: record_to_wire(updated),
    }))
}
