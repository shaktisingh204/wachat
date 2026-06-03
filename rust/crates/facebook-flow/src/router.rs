//! Axum router mounting the 4 Facebook flow-builder endpoints under
//! `/v1/facebook/flow` (caller nests the prefix).

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, State},
    routing::get,
};
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::Result;

use crate::dto::{AckResult, FacebookFlowRecord, FacebookFlowSummary, SaveFlowReq, SaveFlowResult};
use crate::state::FacebookFlowState;
use crate::store;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    FacebookFlowState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/projects/{project_id}/flows",
            get(list_flows).post(save_flow),
        )
        .route("/{flow_id}", get(get_flow).delete(delete_flow))
}

async fn list_flows(
    user: AuthUser,
    State(s): State<FacebookFlowState>,
    Path(project_id): Path<String>,
) -> Result<Json<Vec<FacebookFlowSummary>>> {
    // Match the TS getFacebookFlows: invalid id / no access → empty list.
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => return Ok(Json(Vec::new())),
    };
    match store::list_flows(&s.mongo, &project).await {
        Ok(v) => Ok(Json(v)),
        Err(_) => Ok(Json(Vec::new())),
    }
}

async fn save_flow(
    user: AuthUser,
    State(s): State<FacebookFlowState>,
    Path(project_id): Path<String>,
    Json(body): Json<SaveFlowReq>,
) -> Result<Json<SaveFlowResult>> {
    // Match TS: explicit error envelope rather than a 4xx for forbidden /
    // bad project, so the form action surfaces it in the same shape.
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(SaveFlowResult {
                error: Some("Access denied".to_owned()),
                ..Default::default()
            }));
        }
    };
    Ok(Json(store::save_flow(&s.mongo, &project, body).await?))
}

async fn get_flow(
    user: AuthUser,
    State(s): State<FacebookFlowState>,
    Path(flow_id): Path<String>,
) -> Result<Json<Option<FacebookFlowRecord>>> {
    Ok(Json(
        store::get_flow(&s.mongo, &user.tenant_id, &flow_id).await?,
    ))
}

async fn delete_flow(
    user: AuthUser,
    State(s): State<FacebookFlowState>,
    Path(flow_id): Path<String>,
) -> Result<Json<AckResult>> {
    Ok(Json(
        store::delete_flow(&s.mongo, &user.tenant_id, &flow_id).await?,
    ))
}
