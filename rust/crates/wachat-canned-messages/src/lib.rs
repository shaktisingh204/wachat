//! # wachat-canned-messages
//!
//! Axum router for the `/wachat/settings/canned` page: per-project pre-written
//! message snippets plus per-tenant canned-message settings. Mounted under
//! `/v1/wachat/canned-messages`:
//!
//! ```ignore
//! .nest("/v1/wachat/canned-messages", wachat_canned_messages::router::<AppState>())
//! ```
//!
//! CRUD over `wa_canned_messages` and an upserted `wa_canned_message_settings`
//! doc, scoped to the authenticated user (`userId`) and the project
//! (`projectId`). Generic over the caller's state `S`; needs a
//! [`WachatCannedMessagesState`] and the JWT verifier config, both pulled via
//! [`FromRef`](axum::extract::FromRef).

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

pub use state::WachatCannedMessagesState;

/// Build the canned-messages router (caller nests under
/// `/v1/wachat/canned-messages`).
///
/// ```text
/// GET    /{id}                 — list_messages    (id = projectId; favourites first, then name)
/// POST   /{id}                 — create_message   (id = projectId)
/// DELETE /{id}                 — delete_message   (id = messageId)
/// GET    /{id}/settings        — get_settings     (id = projectId)
/// PUT    /{id}/settings        — update_settings  (id = projectId; upsert)
/// PUT    /{id}/{message_id}    — update_message
/// ```
///
/// Axum 0.8 rejects two single-segment routes whose param names differ, so the
/// first path param is named `{id}` and shared across GET/POST (projectId) and
/// DELETE (messageId); each handler reads it in its own scope. The literal
/// `/settings` route is more specific than `/{id}/{message_id}` and wins for
/// the `settings` suffix.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatCannedMessagesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/{id}",
            get(handlers::list_messages)
                .post(handlers::create_message)
                .delete(handlers::delete_message),
        )
        .route(
            "/{id}/settings",
            get(handlers::get_settings).put(handlers::update_settings),
        )
        .route("/{id}/{message_id}", axum::routing::put(handlers::update_message))
}
