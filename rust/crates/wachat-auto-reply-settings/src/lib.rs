//! # wachat-auto-reply-settings
//!
//! Axum router for the `/wachat/auto-reply` page: the project-scoped
//! `autoReplySettings.*` and `optInOutSettings` sub-documents stored on
//! the `projects` collection. Mounted under
//! `/v1/wachat/auto-reply-settings`:
//!
//! ```ignore
//! .nest(
//!     "/v1/wachat/auto-reply-settings",
//!     wachat_auto_reply_settings::router::<AppState>(),
//! )
//! ```
//!
//! Migrates the native-Mongo writes in
//! `src/app/actions/project.actions.ts` (`handleUpdateMasterSwitch`,
//! `handleUpdateAutoReplySettings`, `handleUpdateOptInOutSettings`) into
//! one scoped `$set` per endpoint. Every route enforces the
//! owner-or-agent project guard. Generic over the caller's state `S`;
//! needs a [`WachatAutoReplySettingsState`] and the JWT verifier config,
//! both pulled via [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, patch, put},
};
use sabnode_auth::AuthConfig;

pub use state::WachatAutoReplySettingsState;

/// Build the auto-reply-settings router (caller nests under
/// `/v1/wachat/auto-reply-settings`).
///
/// ```text
/// GET   /{project_id}                  — get_settings
/// PATCH /{project_id}/master-switch    — update_master_switch
/// PUT   /{project_id}/welcome-message  — update_welcome_message
/// PUT   /{project_id}/inactive-hours   — update_inactive_hours
/// PUT   /{project_id}/general          — update_general
/// PUT   /{project_id}/ai-assistant     — update_ai_assistant
/// PUT   /{project_id}/opt-in-out       — update_opt_in_out
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatAutoReplySettingsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/{project_id}", get(handlers::get_settings))
        .route(
            "/{project_id}/master-switch",
            patch(handlers::update_master_switch),
        )
        .route(
            "/{project_id}/welcome-message",
            put(handlers::update_welcome_message),
        )
        .route(
            "/{project_id}/inactive-hours",
            put(handlers::update_inactive_hours),
        )
        .route("/{project_id}/general", put(handlers::update_general))
        .route(
            "/{project_id}/ai-assistant",
            put(handlers::update_ai_assistant),
        )
        .route("/{project_id}/opt-in-out", put(handlers::update_opt_in_out))
}
