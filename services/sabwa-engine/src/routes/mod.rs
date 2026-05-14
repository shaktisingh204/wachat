//! HTTP route handlers for the sabwa-engine service.
//!
//! Each submodule owns the handlers and DTOs for one resource family
//! (sessions, chats, messages, etc.). The top-level [`router`] function
//! mounts them under the shared `AppState`.

use axum::Router;

use crate::state::AppState;

pub mod broadcasts;
pub mod bulk;
pub mod chats;
pub mod contacts;
pub mod groups;
pub mod messages;
pub mod scheduled;
pub mod sessions;

/// Build the top-level Axum router for the engine HTTP API.
///
/// All resource routers are nested under their canonical path prefix and
/// share the supplied [`AppState`].
pub fn router(state: AppState) -> Router {
    Router::new()
        .nest("/sessions", sessions::router())
        .nest("/chats", chats::router())
        .nest("/messages", messages::router())
        .nest("/groups", groups::router())
        .nest("/contacts", contacts::router())
        .nest("/scheduled", scheduled::router())
        .nest("/broadcasts", broadcasts::router())
        .nest("/bulk", bulk::router())
        .with_state(state)
}
