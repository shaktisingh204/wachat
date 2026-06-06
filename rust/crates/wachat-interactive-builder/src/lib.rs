//! # wachat_interactive_builder
//!
//! Axum router for the `/wachat/templates/interactive-message-builder` page:
//! saved interactive-message templates. Mounted under
//! `/v1/wachat/interactive-builder`:
//!
//! ```ignore
//! .nest("/v1/wachat/interactive-builder", wachat_interactive_builder::router::<AppState>())
//! ```
//!
//! Pure CRUD over `wa_interactive_templates`, scoped to the authenticated
//! user + project. Generic over the caller's state `S`; needs a
//! [`WachatInteractiveBuilderState`] and the JWT verifier config, both pulled
//! via [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get},
};
use sabnode_auth::AuthConfig;

pub use state::WachatInteractiveBuilderState;

/// Build the interactive-builder router (caller nests under
/// `/v1/wachat/interactive-builder`).
///
/// ```text
/// GET    /templates       — list_templates  (?projectId=)
/// POST   /templates       — save_template
/// DELETE /templates/{id}  — delete_template
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatInteractiveBuilderState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/templates",
            get(handlers::list_templates).post(handlers::save_template),
        )
        .route("/templates/{id}", delete(handlers::delete_template))
}
