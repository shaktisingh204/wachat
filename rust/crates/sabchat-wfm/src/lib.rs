//! # sabchat-wfm
//!
//! Axum router for the SabChat **workforce management** surface. Mounted under
//! `/v1/sabchat/wfm` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/wfm", sabchat_wfm::router::<AppState>())
//! ```
//!
//! ## Routes
//!
//! | Method | Path        | Handler    | Notes                                  |
//! |--------|-------------|------------|----------------------------------------|
//! | `GET`  | `/forecast` | `forecast` | Volume + staffing by hour-of-week.     |
//!
//! The forecast aggregates `sabchat_conversations.createdAt` over a look-back
//! window into an average-volume + recommended-agents grid (recommended =
//! ceil(avgVolume / targetPerAgentPerHour)). Read-only; tenant-scoped on the
//! JWT claim.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;

pub use state::SabChatWfmState;

/// Build the sabchat WFM router (mounted relative under `/v1/sabchat/wfm`).
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatWfmState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/forecast", get(handlers::forecast))
}
