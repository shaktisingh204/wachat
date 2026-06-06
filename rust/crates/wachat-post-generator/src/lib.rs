//! # wachat-post-generator
//!
//! Backs the `/wachat/post-generator` page's *persistence* + *publish*
//! halves. AI generation itself stays in the Next streaming route
//! (`/wachat/post-generator/api`) — this crate keeps the drafts a user saves,
//! records publish intents, and performs the Meta Graph publish to the
//! connected Facebook Page feed.
//!
//! Mounted under `/v1/wachat/post-generator` from the API binary:
//!
//! ```ignore
//! .nest("/v1/wachat/post-generator", wachat_post_generator::router::<AppState>())
//! ```
//!
//! ```text
//! GET    /drafts?projectId=                 — list_drafts
//! POST   /drafts                            — save_draft
//! DELETE /drafts/{id}                       — delete_draft
//! POST   /publish/facebook                  — publish_facebook (EXTERNAL seam)
//! POST   /publish/whatsapp-status           — publish_whatsapp_status
//! GET    /publish-log?projectId=            — publish_log
//! ```
//!
//! ## External seam
//!
//! The Meta Graph publish is isolated in [`graph_publish`] — the only module
//! that performs network I/O. With no/empty FB token the publish handlers
//! persist a `failed` `wa_post_publish_log` row and return a typed
//! [`ApiError::BadRequest`](sabnode_common::ApiError); they never panic and
//! never unwrap a network result. Collections: `wa_post_drafts`,
//! `wa_post_publish_log`; FB page token sourced from the `projects` row.

pub mod dto;
pub mod graph_publish;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatPostGeneratorState;

/// Build the post-generator router (caller nests under
/// `/v1/wachat/post-generator`). Generic over the caller's state `S`; needs a
/// [`WachatPostGeneratorState`] and the JWT verifier config, both pulled via
/// [`FromRef`](axum::extract::FromRef).
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatPostGeneratorState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/drafts",
            get(handlers::list_drafts).post(handlers::save_draft),
        )
        .route("/drafts/{id}", axum::routing::delete(handlers::delete_draft))
        .route("/publish/facebook", post(handlers::publish_facebook))
        .route(
            "/publish/whatsapp-status",
            post(handlers::publish_whatsapp_status),
        )
        .route("/publish-log", get(handlers::publish_log))
}
