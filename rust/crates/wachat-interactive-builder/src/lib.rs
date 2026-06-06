//! # wachat_interactive_builder
//!
//! SKELETON — to be fleshed out by the WaChat completion campaign. The
//! `router` returns an empty Router so the workspace compiles; the
//! authoring agent adds routes + handlers + dtos.
pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef};
use sabnode_auth::AuthConfig;

pub use state::WachatInteractiveBuilderState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatInteractiveBuilderState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
}
