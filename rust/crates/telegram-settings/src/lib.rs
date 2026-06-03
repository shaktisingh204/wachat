//! # telegram-settings
//!
//! Project-level + per-bot policy layer for the Telegram modules. This
//! crate stores defaults (parse mode, signature, retention, rate
//! limits), business hours, notification routing, security and GDPR
//! policy. It does NOT replace per-bot Telegram Bot API setters in
//! [`telegram_bots`] (e.g. `setMyName`, `setMyDescription`); those
//! continue to call Telegram directly. Instead, other Telegram crates
//! and workers consult this crate via the helper functions in
//! [`crate::settings`] to know how to format outgoing messages, when
//! they may send, and how long to retain artefacts.
//!
//! Mount under `/v1/telegram/settings`.

pub mod handlers;
pub mod settings;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use settings::{
    BusinessHoursEntry, BusinessHoursSettings, DefaultsSettings, EffectiveSettings, GdprSettings,
    NotificationsSettings, OutOfHoursReply, ProjectSettings, RateLimitDefaults, RateLimitError,
    RetentionDays, SecuritySettings, allowed_to_send, default_project_settings,
    get_effective_settings, is_within_business_hours,
};
pub use state::TelegramSettingsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramSettingsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::get_project).put(handlers::put_project))
        .route("/effective", get(handlers::get_effective))
        .route(
            "/overrides",
            get(handlers::get_overrides)
                .put(handlers::put_overrides)
                .delete(handlers::delete_overrides),
        )
        .route("/test-out-of-hours", post(handlers::test_out_of_hours))
        .route("/export-data", post(handlers::export_data))
        .route("/delete-data", post(handlers::delete_data))
        .route("/gdpr-requests", get(handlers::list_gdpr_requests))
        .route("/audit", get(handlers::list_audit))
        // Catch-all helpers — we keep the routes thin and let the
        // handlers reject unknown sub-paths. The explicit list above is
        // the authoritative API surface.
        .route("/_unused", delete(handlers::noop))
}
