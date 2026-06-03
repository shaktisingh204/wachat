//! # telegram-mini-apps
//!
//! Per-project registry of Telegram Mini Apps (Web Apps). Each record
//! pins a name + slug + `webAppUrl` + branding + theme params; on top
//! of that we expose action endpoints:
//!   * send-to-chat (inline keyboard with `web_app` button),
//!   * set-as-menu-button on the bot,
//!   * validate `initData` HMAC against the bot token (Telegram spec),
//!   * list recent validated sessions + per-day analytics.
//!
//! Mount under `/v1/telegram/mini-apps`.

pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramMiniAppsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramMiniAppsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::create))
        .route("/validate-init-data", post(handlers::validate_init_data))
        .route(
            "/{app_id}",
            get(handlers::get_one)
                .put(handlers::update)
                .delete(handlers::delete_one),
        )
        .route("/{app_id}/send", post(handlers::send_to_chat))
        .route("/{app_id}/set-menu-button", post(handlers::set_menu_button))
        .route("/{app_id}/sessions", get(handlers::list_sessions))
        .route("/{app_id}/analytics", get(handlers::analytics))
}
