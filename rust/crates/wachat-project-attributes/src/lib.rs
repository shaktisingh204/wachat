//! # wachat-project-attributes
//!
//! Axum router for the `/wachat/settings/attributes` page: the project's
//! custom **user attributes** (segmentation / personalization fields).
//! Mounted under `/v1/wachat/project-attributes`:
//!
//! ```ignore
//! .nest("/v1/wachat/project-attributes", wachat_project_attributes::router::<AppState>())
//! ```
//!
//! A user attribute is an embedded record on the `projects` document
//! (`projects.userAttributes[]`); there is **no** separate collection.
//! `GET` returns the array, `PATCH` replaces it wholesale. Both routes
//! are owner-or-agent scoped to the authenticated caller.
//!
//! Generic over the caller's state `S`; needs a
//! [`WachatProjectAttributesState`] and the JWT verifier config, both
//! pulled via [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::get,
};
use sabnode_auth::AuthConfig;

pub use state::WachatProjectAttributesState;

/// Build the project-attributes router (caller nests under
/// `/v1/wachat/project-attributes`).
///
/// ```text
/// GET   /projects/{id}/attributes   — list_attributes
/// PATCH /projects/{id}/attributes   — replace_attributes
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatProjectAttributesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/projects/{id}/attributes",
            get(handlers::list_attributes).patch(handlers::replace_attributes),
        )
}
