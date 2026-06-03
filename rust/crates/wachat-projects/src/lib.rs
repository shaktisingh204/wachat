//! # wachat-projects
//!
//! Project-domain HTTP surface — list and detail with plan join. Replaces
//! the Next.js `getProjects()` / `getProjectById()` server actions for the
//! `/wachat` and `/dashboard` layouts so navigation no longer pays a
//! Mongo + serialize round-trip on every render.
//!
//! Mount under `/v1/projects` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/projects", wachat_projects::router::<AppState>())
//! ```

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

pub use state::WachatProjectsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_projects))
        .route("/{id}", get(handlers::get_project))
}
