//! # wachat_flow_events
//!
//! Axum router for flow trigger analytics. Mounted under
//! `/v1/wachat/flow-events`:
//!
//! ```ignore
//! .nest("/v1/wachat/flow-events", wachat_flow_events::router::<AppState>())
//! ```
//!
//! Read-only aggregation over `wa_flow_events`
//! (`{ flowId, projectId, userId, ts }`), scoped to the authenticated user.
//! Returns real counts (zeros / null when a flow has no events) — never
//! fabricated values. Generic over the caller's state `S`; needs a
//! [`WachatFlowEventsState`] and the JWT verifier config, both pulled via
//! [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;

pub use state::WachatFlowEventsState;

/// Build the flow-events router (caller nests under `/v1/wachat/flow-events`).
///
/// ```text
/// GET /                      — batch_metrics (?projectId=…)
/// GET /{flowId}/metrics      — flow_metrics
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFlowEventsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::batch_metrics))
        .route("/{flowId}/metrics", get(handlers::flow_metrics))
}
