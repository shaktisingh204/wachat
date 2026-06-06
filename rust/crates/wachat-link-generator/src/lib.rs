//! # wachat-link-generator
//!
//! Axum router for the `/wachat/whatsapp-link-generator` page. Mounted
//! under `/v1/wachat/link-generator`:
//!
//! ```ignore
//! .nest("/v1/wachat/link-generator", wachat_link_generator::router::<AppState>())
//! ```
//!
//! Two surfaces, both scoped to the authenticated user:
//!
//! - **Saved links** over `wa_link_clicks` (existing collection; a saved
//!   link doubles as a click event for the link-tracking page), guarded
//!   owner-or-agent per project.
//! - **Internal shortener** over `wa_short_links` (new collection),
//!   replacing the old tinyurl round-trip — no external deps.
//!
//! Generic over the caller's state `S`; needs a
//! [`WachatLinkGeneratorState`] and the JWT verifier config, both pulled
//! via [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatLinkGeneratorState;

/// Build the link-generator router (caller nests under
/// `/v1/wachat/link-generator`).
///
/// ```text
/// POST /shorten                       — shorten
/// GET  /projects/{project_id}/links   — list_links
/// POST /projects/{project_id}/links   — save_link
/// ```
///
/// Literal segments (`shorten`, `projects`, `links`) are declared before
/// the `{project_id}` param, per the axum 0.8 routing rules.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatLinkGeneratorState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/shorten", post(handlers::shorten))
        .route(
            "/projects/{project_id}/links",
            get(handlers::list_links).post(handlers::save_link),
        )
}
