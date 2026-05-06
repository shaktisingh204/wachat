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
        .route(
            "/",
            get(handlers::list_bots).post(handlers::connect_bot),
        )
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
}
