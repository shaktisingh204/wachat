//! Mountable router for the embedded Pipeline + Stage endpoints.
//!
//! Mount under `/v1/crm/pipelines` from the host `api` crate:
//!
//! ```ignore
//! use crm_pipelines;
//! .nest("/v1/crm/pipelines", crm_pipelines::router::<AppState>())
//! ```

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router. State must expose `MongoHandle` + `Arc<AuthConfig>`
/// via `FromRef` (the standard `AppState` already does).
///
/// Routes (relative — caller nests under `/v1/crm/pipelines`):
///
/// ```text
/// GET    /                                    — list_pipelines
/// POST   /                                    — create_pipeline
/// GET    /{pipelineId}                        — get_pipeline
/// PATCH  /{pipelineId}                        — update_pipeline
/// DELETE /{pipelineId}                        — delete_pipeline
/// POST   /{pipelineId}/stages                 — add_stage
/// PATCH  /{pipelineId}/stages/{stageId}       — update_stage
/// DELETE /{pipelineId}/stages/{stageId}       — remove_stage
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_pipelines).post(handlers::create_pipeline),
        )
        .route(
            "/{pipelineId}",
            get(handlers::get_pipeline)
                .patch(handlers::update_pipeline)
                .delete(handlers::delete_pipeline),
        )
        .route(
            "/{pipelineId}/stages",
            axum::routing::post(handlers::add_stage),
        )
        .route(
            "/{pipelineId}/stages/{stageId}",
            axum::routing::patch(handlers::update_stage).delete(handlers::remove_stage),
        )
}
