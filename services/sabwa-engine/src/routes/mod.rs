//! HTTP route handlers for the sabwa-engine service.
//!
//! Each submodule owns the handlers and DTOs for one resource family
//! (sessions, chats, messages, etc.). The top-level [`router`] function
//! mounts them under the shared `AppState`.
//!
//! There are two distinct authentication boundaries (see [`crate::auth`]):
//!
//! - The default tree (mounted under `/v1`) is gated by
//!   [`crate::auth::require_service_token`] in [`crate::build_app`] — only the
//!   Next.js layer talks to it.
//! - The [`public`] sub-tree (mounted under `/v1/public`) is gated by
//!   [`crate::auth::require_api_key`] — external integrators call it directly
//!   with their `sk_live_*` keys.

use axum::{middleware, Router};

use crate::state::AppState;

pub mod api_keys;
pub mod audit;
pub mod broadcasts;
pub mod bulk;
pub mod chats;
pub mod contacts;
pub mod groups;
pub mod messages;
pub mod public;
pub mod realtime;
pub mod scheduled;
pub mod sessions;
pub mod webhooks;

/// Build the top-level Axum router for the engine HTTP API.
///
/// All resource routers are nested under their canonical path prefix and
/// share the supplied [`AppState`].
///
/// Realtime note: only the token-minting endpoint
/// (`POST /realtime/token`) lives under this service-token-gated tree.
/// The browser-facing SSE/WS streams are mounted by
/// [`realtime_stream_router`] and attached as a sibling in
/// [`crate::build_app`] so they can use their own per-request JWT auth
/// instead of the service token.
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
        .nest("/audit", audit::router())
        .nest("/api-keys", api_keys::router())
        .nest("/webhooks", webhooks::router())
        .nest("/realtime", realtime::router())
        .with_state(state)
}

/// Build the public, API-key-gated router that sits under `/v1/public`.
///
/// Mounted as a sibling of [`router`] in [`crate::build_app`] so it can carry
/// its own `require_api_key` middleware without the service-token gate.
pub fn public_router(state: AppState) -> Router {
    public::router()
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            crate::auth::require_api_key,
        ))
        .with_state(state)
}

/// Build the browser-facing realtime streaming router (SSE + WS).
///
/// These routes intentionally do **not** require the service token — they
/// authenticate via a short-lived JWT carried in the `?token=` query string
/// (see [`crate::auth::issue_stream_token`] /
/// [`crate::auth::verify_stream_token`]). The token is minted by
/// `POST /v1/realtime/token` which itself stays behind the service-token gate.
///
/// Mounted as a sibling of [`router`] in [`crate::build_app`] under the
/// `/v1/realtime` prefix so it shares the URL space with the token endpoint
/// but skips the service-token middleware.
pub fn realtime_stream_router(state: AppState) -> Router {
    crate::realtime::ws::router()
        .merge(crate::realtime::sse::router())
        .with_state(state)
}
