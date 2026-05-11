//! # telegram-flows
//!
//! Telegram-scoped visual flows — a SabFlow-style graph (nodes + edges) bound
//! to Telegram-specific triggers and actions. Mounted at `/v1/telegram/flows`
//! by the `api` crate.
//!
//! Endpoints (all project-scoped via `require_project`):
//!
//! ```text
//!   GET    /                       list({ projectId, status?, search?, page?, limit? })
//!   POST   /                       create draft
//!   GET    /{flowId}               get one
//!   PUT    /{flowId}               update draft only
//!   DELETE /{flowId}               delete
//!   POST   /{flowId}/publish       validate + bump version
//!   POST   /{flowId}/enable        status → published
//!   POST   /{flowId}/disable       status → disabled
//!   POST   /{flowId}/test          simulated run, returns step trace
//!   GET    /{flowId}/versions      list version snapshots
//!   GET    /{flowId}/versions/{v}  fetch a specific version
//!   POST   /{flowId}/duplicate     clone as new draft
//!   GET    /{flowId}/runs          paginated run-log (cursor based)
//! ```

pub mod dto;
pub mod handlers;
pub mod state;
pub mod validation;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramFlowsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramFlowsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // `GET /` → list, `POST /` → create draft
        .route("/", get(handlers::list).post(handlers::create))
        // `GET /{id}` → fetch, `PUT /{id}` → update draft, `DELETE /{id}` → delete
        .route(
            "/{flow_id}",
            get(handlers::get_one)
                .put(handlers::update)
                .delete(handlers::delete_one),
        )
        .route("/{flow_id}/publish", post(handlers::publish))
        .route("/{flow_id}/enable", post(handlers::enable))
        .route("/{flow_id}/disable", post(handlers::disable))
        .route("/{flow_id}/test", post(handlers::test))
        .route("/{flow_id}/versions", get(handlers::list_versions))
        .route("/{flow_id}/versions/{version}", get(handlers::get_version))
        .route("/{flow_id}/duplicate", post(handlers::duplicate))
        .route("/{flow_id}/runs", get(handlers::list_runs))
}
