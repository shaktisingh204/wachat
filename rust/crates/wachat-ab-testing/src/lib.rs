//! # wachat_ab_testing
//! SKELETON — fleshed out by the WaChat completion campaign.
pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;
use axum::{Router, extract::FromRef};
use sabnode_auth::AuthConfig;
pub use state::WachatAbTestingState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatAbTestingState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
}
