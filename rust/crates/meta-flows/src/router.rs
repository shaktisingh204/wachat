//! Axum router mounting the 10 Meta Flows endpoints under
//! `/v1/meta/flows` (caller nests the prefix).

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, Query, State},
    routing::{get, post},
};
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::Result;

use crate::dto::{
    ActionResult, CreateFlowOut, CreateFlowReq, DeleteQuery, MetaFlowOut, PreviewOut, PreviewReq,
    SaveDraftReq, SyncOutcome, UpdateMetadataReq,
};
use crate::state::MetaFlowsState;
use crate::store;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MetaFlowsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/projects/{project_id}/flows",
            get(list_flows).post(create_flow),
        )
        .route("/projects/{project_id}/sync", post(sync_flows))
        .route("/{flow_id}", get(get_flow).delete(delete_flow))
        .route("/{flow_id}/draft", post(save_draft))
        .route("/{flow_id}/metadata", post(update_metadata))
        .route("/{flow_id}/publish", post(publish))
        .route("/{flow_id}/deprecate", post(deprecate))
        .route("/{flow_id}/preview", post(preview))
}

// ---------------------------------------------------------------------
// project-scoped collection routes
// ---------------------------------------------------------------------

async fn list_flows(
    user: AuthUser,
    State(s): State<MetaFlowsState>,
    Path(project_id): Path<String>,
) -> Result<Json<Vec<MetaFlowOut>>> {
    let project = store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await?;
    Ok(Json(store::list_flows(&s.mongo, &project).await?))
}

async fn create_flow(
    user: AuthUser,
    State(s): State<MetaFlowsState>,
    Path(project_id): Path<String>,
    Json(body): Json<CreateFlowReq>,
) -> Result<Json<ActionResult<CreateFlowOut>>> {
    let project = store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await?;
    Ok(Json(
        store::create_flow(&s.mongo, &s.http, &project, body).await?,
    ))
}

async fn sync_flows(
    user: AuthUser,
    State(s): State<MetaFlowsState>,
    Path(project_id): Path<String>,
) -> Result<Json<ActionResult<SyncOutcome>>> {
    let project = store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await?;
    Ok(Json(
        store::sync_from_meta(&s.mongo, &s.http, &project).await?,
    ))
}

// ---------------------------------------------------------------------
// per-flow routes — resolve the owning project from the stored flow row
// (matches the TS `loadOwnedFlow` shape so callers don't need to thread
// `projectId` through every request).
// ---------------------------------------------------------------------

async fn get_flow(
    user: AuthUser,
    State(s): State<MetaFlowsState>,
    Path(flow_id): Path<String>,
) -> Result<Json<Option<MetaFlowOut>>> {
    let (_flow, project) =
        match store::load_flow_with_project(&s.mongo, &user.tenant_id, &flow_id).await {
            Ok(t) => t,
            Err(sabnode_common::ApiError::NotFound(_)) => return Ok(Json(None)),
            Err(e) => return Err(e),
        };
    Ok(Json(
        store::get_flow(&s.mongo, &s.http, &project, &flow_id).await?,
    ))
}

async fn save_draft(
    user: AuthUser,
    State(s): State<MetaFlowsState>,
    Path(flow_id): Path<String>,
    Json(body): Json<SaveDraftReq>,
) -> Result<Json<ActionResult<()>>> {
    let (_flow, project) =
        store::load_flow_with_project(&s.mongo, &user.tenant_id, &flow_id).await?;
    Ok(Json(
        store::save_draft(&s.mongo, &s.http, &project, &flow_id, body).await?,
    ))
}

async fn update_metadata(
    user: AuthUser,
    State(s): State<MetaFlowsState>,
    Path(flow_id): Path<String>,
    Json(body): Json<UpdateMetadataReq>,
) -> Result<Json<ActionResult<()>>> {
    let (_flow, project) =
        store::load_flow_with_project(&s.mongo, &user.tenant_id, &flow_id).await?;
    Ok(Json(
        store::update_metadata(&s.mongo, &s.http, &project, &flow_id, body).await?,
    ))
}

async fn publish(
    user: AuthUser,
    State(s): State<MetaFlowsState>,
    Path(flow_id): Path<String>,
) -> Result<Json<ActionResult<()>>> {
    let (_flow, project) =
        store::load_flow_with_project(&s.mongo, &user.tenant_id, &flow_id).await?;
    Ok(Json(
        store::publish(&s.mongo, &s.http, &project, &flow_id).await?,
    ))
}

async fn deprecate(
    user: AuthUser,
    State(s): State<MetaFlowsState>,
    Path(flow_id): Path<String>,
) -> Result<Json<ActionResult<()>>> {
    let (_flow, project) =
        store::load_flow_with_project(&s.mongo, &user.tenant_id, &flow_id).await?;
    Ok(Json(
        store::deprecate(&s.mongo, &s.http, &project, &flow_id).await?,
    ))
}

async fn delete_flow(
    user: AuthUser,
    State(s): State<MetaFlowsState>,
    Path(flow_id): Path<String>,
    Query(d): Query<DeleteQuery>,
) -> Result<Json<ActionResult<()>>> {
    let (_flow, project) =
        store::load_flow_with_project(&s.mongo, &user.tenant_id, &flow_id).await?;
    Ok(Json(
        store::delete_flow(&s.mongo, &s.http, &project, &flow_id, d.meta_id).await?,
    ))
}

async fn preview(
    user: AuthUser,
    State(s): State<MetaFlowsState>,
    Path(flow_id): Path<String>,
    Json(body): Json<PreviewReq>,
) -> Result<Json<ActionResult<PreviewOut>>> {
    let (_flow, project) =
        store::load_flow_with_project(&s.mongo, &user.tenant_id, &flow_id).await?;
    Ok(Json(
        store::get_preview(&s.mongo, &s.http, &project, &flow_id, body).await?,
    ))
}
