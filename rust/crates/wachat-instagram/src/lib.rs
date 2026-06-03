//! # wachat-instagram
//!
//! Rust port of `src/app/actions/instagram.actions.ts` — the Instagram
//! Graph API surface for SabNode. The legacy TS file talked directly to
//! `graph.facebook.com` with `axios` and a per-call `?access_token=`
//! query string. This crate re-implements the same nine actions on top of
//! [`wachat_meta_client::MetaClient`] so retry, timeout, error parsing and
//! observability are unified across every Meta call we make.
//!
//! ## Endpoints
//!
//! Mounted by the `api` crate at `/v1/instagram` (see the integration step):
//!
//! ```text
//! GET    /projects/:id/account                              → get_account
//! GET    /projects/:id/media                                → list_media
//! POST   /projects/:id/media                                → create_image_post
//! GET    /projects/:id/media/:media_id                      → media_details
//! GET    /projects/:id/media/:media_id/comments             → comments
//! GET    /projects/:id/stories                              → stories
//! GET    /projects/:id/discover/:username                   → discover
//! GET    /projects/:id/hashtag-search?q=...                 → hashtag_search
//! GET    /projects/:id/hashtags/:hashtag_id/recent-media    → hashtag_recent_media
//! GET    /projects/:id/hashtags/:hashtag_id/top-media       → hashtag_top_media
//! GET    /projects/:id/reels?limit=25                       → reels
//! GET    /projects/:id/media/:media_id/insights?metrics=... → media_insights
//! GET    /projects/:id/conversations                        → conversations
//! GET    /projects/:id/conversations/:conv_id/messages      → conversation_messages
//! ```
//!
//! ## Tenancy
//!
//! Every endpoint loads the project document by `_id` and asserts the
//! caller's `tenant_id` matches the project's `userId.toHex()` — the same
//! contract used by `meta-suite`, `wachat-features`, and
//! `facebook-flow`. A future `sabnode-tenancy` slice will subsume this.
//!
//! ## Response shape
//!
//! Every legacy server action returned `{ payload? , error? }` so callers
//! could branch on `error` rather than HTTP status. We preserve that
//! envelope verbatim, so the TypeScript shim
//! (`src/lib/rust-client/wachat-instagram.ts`) can pass responses through
//! unchanged. Real HTTP errors are reserved for tenancy / 404 / 400 cases.

pub mod dto;
pub mod handlers;
pub mod instagram;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;

pub use state::WachatInstagramState;

/// Build the wachat-instagram router. Mounted under `/v1/instagram` by the
/// orchestrating `api` crate.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatInstagramState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/projects/{project_id}/account", get(handlers::get_account))
        .route(
            "/projects/{project_id}/media",
            get(handlers::list_media).post(handlers::create_image_post),
        )
        .route(
            "/projects/{project_id}/media/{media_id}",
            get(handlers::media_details),
        )
        .route(
            "/projects/{project_id}/media/{media_id}/comments",
            get(handlers::comments),
        )
        .route("/projects/{project_id}/stories", get(handlers::stories))
        .route(
            "/projects/{project_id}/discover/{username}",
            get(handlers::discover),
        )
        .route(
            "/projects/{project_id}/hashtag-search",
            get(handlers::hashtag_search),
        )
        .route(
            "/projects/{project_id}/hashtags/{hashtag_id}/recent-media",
            get(handlers::hashtag_recent_media),
        )
        .route(
            "/projects/{project_id}/hashtags/{hashtag_id}/top-media",
            get(handlers::hashtag_top_media),
        )
        .route("/projects/{project_id}/reels", get(handlers::reels))
        .route(
            "/projects/{project_id}/media/{media_id}/insights",
            get(handlers::media_insights),
        )
        .route(
            "/projects/{project_id}/conversations",
            get(handlers::conversations),
        )
        .route(
            "/projects/{project_id}/conversations/{conversation_id}/messages",
            get(handlers::conversation_messages),
        )
        .route(
            "/projects/{project_id}/messages",
            axum::routing::post(handlers::send_message),
        )
}
