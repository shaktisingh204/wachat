//! Axum router that mounts the broadcast-counter HTTP endpoint.
//!
//! Routes (mounted relative — caller nests under
//! `/v1/wachat/webhook-status`):
//!
//! ```text
//! POST /broadcast-statuses    — apply broadcast-counter side effects for a Meta webhook batch
//! ```
//!
//! Wiring (from the orchestrator `api` crate):
//!
//! ```ignore
//! use wachat_webhook_status::{router as webhook_status_router, WachatWebhookStatusState};
//!
//! // in AppState construction:
//! let webhook_status = WachatWebhookStatusState::new(mongo.clone());
//!
//! // in router build:
//! .nest("/v1/wachat/webhook-status", webhook_status_router::<AppState>())
//!
//! // in state FromRef impls:
//! impl FromRef<AppState> for WachatWebhookStatusState {
//!     fn from_ref(s: &AppState) -> Self { s.webhook_status.clone() }
//! }
//! ```
//!
//! `S` is the caller's outer state. The handler needs:
//! - a [`WachatWebhookStatusState`] bundle (Mongo + writer),
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's monolithic `AppState`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::post};
use sabnode_auth::AuthConfig;

use crate::handlers;
use crate::state::WachatWebhookStatusState;

/// Build the broadcast-counter router. Mount under
/// `/v1/wachat/webhook-status`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatWebhookStatusState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/broadcast-statuses", post(handlers::broadcast_statuses))
}
