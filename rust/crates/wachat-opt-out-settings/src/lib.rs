//! # wachat_opt_out_settings
//!
//! Axum router for the project-level **opt-out settings** toggle backing the
//! AI Settings panel on the `/wachat/opt-out` page. Mounted under
//! `/v1/wachat/opt-out-settings`:
//!
//! ```ignore
//! .nest("/v1/wachat/opt-out-settings", wachat_opt_out_settings::router::<AppState>())
//! ```
//!
//! One upserted doc per `{userId, projectId}` in `wa_opt_out_settings`,
//! scoped to the authenticated user. The opt-out LIST itself lives in
//! `wachat-features`; this crate only persists the settings flag(s).
//!
//! Generic over the caller's state `S`; needs a [`WachatOptOutSettingsState`]
//! and the JWT verifier config, both pulled via
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

pub use state::WachatOptOutSettingsState;

/// Build the opt-out-settings router (caller nests under
/// `/v1/wachat/opt-out-settings`).
///
/// ```text
/// GET  /projects/{project_id}  — get_settings (doc or defaults)
/// POST /projects/{project_id}  — upsert_settings
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatOptOutSettingsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route(
        "/projects/{project_id}",
        get(handlers::get_settings).post(handlers::upsert_settings),
    )
}
