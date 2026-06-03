//! # telegram-bots
//!
//! Telegram bot registration, webhook lifecycle and disconnect for the
//! SabNode BFF. Ports the *bots* slice of
//! `src/app/actions/telegram.actions.ts` into Rust:
//!
//! | TS export                          | Route                                                     |
//! |------------------------------------|-----------------------------------------------------------|
//! | `listTelegramBots`                 | `GET    /v1/telegram/bots?projectId={…}`                  |
//! | `getTelegramBot`                   | `GET    /v1/telegram/bots/{bot_id}`                       |
//! | `connectTelegramBot`               | `POST   /v1/telegram/bots`                                |
//! | `disconnectTelegramBot`            | `DELETE /v1/telegram/bots/{bot_id}`                       |
//! | `refreshTelegramWebhookInfo`       | `POST   /v1/telegram/bots/{bot_id}/webhook/refresh`       |
//! | `rotateTelegramWebhookSecret`      | `POST   /v1/telegram/bots/{bot_id}/webhook/rotate`        |
//! | `getTelegramBotInfo`               | `GET    /v1/telegram/bots/{bot_id}/info`                  |
//! | `getTelegramBotCommandsScoped`     | `GET    /v1/telegram/bots/{bot_id}/commands`              |
//! | `setTelegramBotCommandsScoped`     | `POST   /v1/telegram/bots/{bot_id}/commands`              |
//! | `deleteTelegramBotCommands`        | `DELETE /v1/telegram/bots/{bot_id}/commands`              |
//! | `setTelegramBotName`               | `POST   /v1/telegram/bots/{bot_id}/name`                  |
//! | `setTelegramBotDescription`        | `POST   /v1/telegram/bots/{bot_id}/description`           |
//! | `setTelegramBotShortDescription`   | `POST   /v1/telegram/bots/{bot_id}/short-description`     |
//! | `getTelegramBotMenuButton`         | `GET    /v1/telegram/bots/{bot_id}/menu-button`           |
//! | `setTelegramBotMenuButton`         | `POST   /v1/telegram/bots/{bot_id}/menu-button`           |
//! | `getTelegramBotAdminRights`        | `GET    /v1/telegram/bots/{bot_id}/default-admin-rights`  |
//! | `setTelegramBotAdminRights`        | `POST   /v1/telegram/bots/{bot_id}/default-admin-rights`  |
//! | `runTelegramBotHealthCheck`        | `POST   /v1/telegram/bots/{bot_id}/health`                |
//! | `bulkDisconnectTelegramBots`       | `POST   /v1/telegram/bots/bulk-disconnect`                |
//! | `exportTelegramBotsCsv`            | `GET    /v1/telegram/bots/export?projectId={…}`           |
//!
//! Mount under `/v1/telegram/bots` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/telegram/bots", telegram_bots::router::<AppState>())
//! ```
//!
//! ## Auth & access
//!
//! Every handler extracts a [`sabnode_auth::AuthUser`] from the JWT and
//! confirms the caller owns the bot's project before performing any
//! action against Mongo or the Telegram Bot API.
//!
//! ## Telegram Bot API
//!
//! The crate ships a tiny HTTP client in [`bot_api`] that talks directly
//! to `https://api.telegram.org/bot{token}/...`. There is no OAuth; the
//! bot token is the credential. Tokens are stored in the `telegram_bots`
//! Mongo collection in plaintext, mirroring the existing TS convention.
//!
//! ## Webhook
//!
//! The webhook target lives on the Next.js side at
//! `/api/telegram/webhook/{bot_id_hex}`; this crate only registers it
//! against Telegram and persists the result.

pub mod bot_api;
pub mod dto;
pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramBotsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramBotsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // listTelegramBots / connectTelegramBot
        .route("/", get(handlers::list_bots).post(handlers::connect_bot))
        // CSV export — must come before /{bot_id}
        .route("/export", get(handlers::export_csv))
        // bulk disconnect
        .route("/bulk-disconnect", post(handlers::bulk_disconnect))
        // getTelegramBot / disconnectTelegramBot
        .route(
            "/{bot_id}",
            get(handlers::get_bot).delete(handlers::disconnect_bot),
        )
        // refreshTelegramWebhookInfo
        .route(
            "/{bot_id}/webhook/refresh",
            post(handlers::refresh_webhook_info),
        )
        // rotateTelegramWebhookSecret
        .route(
            "/{bot_id}/webhook/rotate",
            post(handlers::rotate_webhook_secret),
        )
        // bot info (getMe refresh)
        .route("/{bot_id}/info", get(handlers::get_bot_info))
        // commands
        .route(
            "/{bot_id}/commands",
            get(handlers::get_commands)
                .post(handlers::set_commands)
                .delete(handlers::delete_commands),
        )
        // profile fields
        .route("/{bot_id}/name", post(handlers::set_name))
        .route("/{bot_id}/description", post(handlers::set_description))
        .route(
            "/{bot_id}/short-description",
            post(handlers::set_short_description),
        )
        // menu button
        .route(
            "/{bot_id}/menu-button",
            get(handlers::get_menu_button).post(handlers::set_menu_button),
        )
        // default administrator rights
        .route(
            "/{bot_id}/default-admin-rights",
            get(handlers::get_default_admin_rights).post(handlers::set_default_admin_rights),
        )
        // health check
        .route("/{bot_id}/health", post(handlers::health_check))
}
