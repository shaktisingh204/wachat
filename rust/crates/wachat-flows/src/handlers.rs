//! HTTP handlers for the `wachat-flows` router.
//!
//! Each handler corresponds 1:1 to a server action in
//! `src/app/actions/flow.actions.ts`. We translate the TS "soft" return
//! shapes (`null` on access deny, `{ error: "Access denied" }` on forbidden
//! mutates) onto HTTP envelopes that match the TS callers' expectations:
//!
//! - List: empty array on access deny (matches `getFlowsForProject`).
//! - GetById: 200 + `null` body on access deny / not found
//!   (matches `getFlowById`).
//! - Save: 200 + `{ error }` envelope on access deny
//!   (matches `saveFlow`'s return type).
//! - Delete: 200 + `{ error }` envelope on access deny
//!   (matches `deleteFlow`).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::oid::ObjectId;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    AckResult, BuilderDataResult, BulkDeleteReq, BulkDeleteResult, BulkStatusReq, BulkStatusResult,
    CloneFlowResult, ProjectIdQuery, SaveFlowReq, SaveFlowResult,
};
use crate::state::WachatFlowsState;
use crate::store;

/// `GET /v1/flows?projectId=…`
///
/// Returns an empty array if the caller is not owner-or-agent of the
/// project. Mirrors `getFlowsForProject` which returns `[]` on any access
/// failure rather than throwing.
pub async fn list_flows(
    user: AuthUser,
    State(s): State<WachatFlowsState>,
    Query(q): Query<ProjectIdQuery>,
) -> Result<Json<Vec<Value>>> {
    let project = match store::load_project_for(&user, &s.mongo, &q.project_id).await {
        Ok(p) => p,
        Err(_) => return Ok(Json(Vec::new())),
    };
    let project_id = match project.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return Ok(Json(Vec::new())),
    };
    match store::list_flows_for_project(&s.mongo, project_id).await {
        Ok(v) => Ok(Json(v)),
        Err(_) => Ok(Json(Vec::new())),
    }
}

/// `GET /v1/flows/:id`
///
/// Returns `Ok(null)` for invalid id / missing / access denied so the TS
/// shim (`getFlowById`) can keep its nullable return type.
pub async fn get_flow(
    user: AuthUser,
    State(s): State<WachatFlowsState>,
    Path(id): Path<String>,
) -> Result<Json<Option<Value>>> {
    Ok(Json(store::get_flow_by_id(&user, &s.mongo, &id).await?))
}

/// `POST /v1/flows`
///
/// Upsert: when `body.flowId` is omitted, creates a new flow; otherwise
/// updates the existing one scoped to (`flowId`, `projectId`).
///
/// Validates the graph for cycles BEFORE writing — the response shape
/// includes `{ error: "Infinite loop detected …" }` so the form can render
/// it inline.
pub async fn save_flow(
    user: AuthUser,
    State(s): State<WachatFlowsState>,
    Json(body): Json<SaveFlowReq>,
) -> Result<Json<SaveFlowResult>> {
    if body.project_id.is_empty() || body.name.trim().is_empty() {
        return Ok(Json(SaveFlowResult {
            error: Some("Project ID and Flow Name are required.".to_owned()),
            ..Default::default()
        }));
    }

    let project = match store::load_project_for(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(SaveFlowResult {
                error: Some("Access denied".to_owned()),
                ..Default::default()
            }));
        }
    };

    let project_id: ObjectId = match project.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Ok(Json(SaveFlowResult {
                error: Some("Failed to save flow.".to_owned()),
                ..Default::default()
            }));
        }
    };

    Ok(Json(store::save_flow(&s.mongo, project_id, body).await?))
}

/// `DELETE /v1/flows/:id`
///
/// Deletes the flow + unsets `contacts.activeFlow` for any contact actively
/// running this flow. Project access is checked via the flow's owning
/// project; non-members get `{ error: "Access denied" }` to match the TS.
pub async fn delete_flow(
    user: AuthUser,
    State(s): State<WachatFlowsState>,
    Path(id): Path<String>,
) -> Result<Json<AckResult>> {
    Ok(Json(store::delete_flow(&user, &s.mongo, &id).await?))
}

/// `GET /v1/flows/builder-data?projectId=…`
///
/// One-shot composition of `getFlowBuilderPageData` — list + initial flow.
/// Saves the builder page from doing two round-trips on first paint.
pub async fn builder_data(
    user: AuthUser,
    State(s): State<WachatFlowsState>,
    Query(q): Query<ProjectIdQuery>,
) -> Result<Json<BuilderDataResult>> {
    // List with project access enforced.
    let project = match store::load_project_for(&user, &s.mongo, &q.project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(BuilderDataResult {
                flows: Vec::new(),
                initial_flow: None,
            }));
        }
    };
    let project_id = project
        .get_object_id("_id")
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let flows = store::list_flows_for_project(&s.mongo, project_id)
        .await
        .unwrap_or_default();

    let initial_flow = match store::first_flow_id(&flows) {
        Some(first_id) => store::get_flow_by_id(&user, &s.mongo, &first_id).await?,
        None => None,
    };

    Ok(Json(BuilderDataResult {
        flows,
        initial_flow,
    }))
}

/// `POST /v1/flows/:id/clone`
///
/// Deep-copies the flow: duplicates `nodes`/`edges`/`triggerKeywords`, suffixes
/// the name with ` (Copy)`, forces `status = "PAUSED"`, and assigns a fresh
/// `_id`. Returns `{ flowId }` for the new copy. Access deny / missing source
/// surface as a soft `{ error }` envelope to match the legacy `cloneFlow`.
#[instrument(skip_all)]
pub async fn clone_flow(
    user: AuthUser,
    State(s): State<WachatFlowsState>,
    Path(id): Path<String>,
) -> Result<Json<CloneFlowResult>> {
    Ok(Json(store::clone_flow(&user, &s.mongo, &id).await?))
}

/// `DELETE /v1/flows/bulk-delete`
///
/// Body `{ flowIds: [] }`. Deletes every flow in the list that the caller can
/// access (owner-or-agent of its project), in one `delete_many`, and unsets
/// `contacts.activeFlow` for affected contacts. Returns `{ deleted }`.
#[instrument(skip_all)]
pub async fn bulk_delete(
    user: AuthUser,
    State(s): State<WachatFlowsState>,
    Json(body): Json<BulkDeleteReq>,
) -> Result<Json<BulkDeleteResult>> {
    Ok(Json(
        store::bulk_delete_flows(&user, &s.mongo, &body.flow_ids).await?,
    ))
}

/// `PATCH /v1/flows/bulk-status`
///
/// Body `{ flowIds: [], status }`. Sets `status` on every accessible flow in
/// the list in one `update_many`. Returns `{ modified }`.
#[instrument(skip_all)]
pub async fn bulk_status(
    user: AuthUser,
    State(s): State<WachatFlowsState>,
    Json(body): Json<BulkStatusReq>,
) -> Result<Json<BulkStatusResult>> {
    let status = body.status.trim();
    if status.is_empty() {
        return Err(ApiError::Validation("status is required.".to_owned()));
    }
    Ok(Json(
        store::bulk_status_flows(&user, &s.mongo, &body.flow_ids, status).await?,
    ))
}
