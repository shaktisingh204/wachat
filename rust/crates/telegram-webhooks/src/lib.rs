//! # telegram-webhooks
//!
//! Per-bot Telegram webhook subscription configuration, the append-only
//! delivery log, the dead-letter queue, replay, and rolled-up analytics.
//!
//! The Bot API itself is a per-bot `setWebhook` / `getWebhookInfo` pair —
//! we call those for the user when they edit a subscription, and on
//! every test/refresh. The real observability value is the delivery log:
//! every Telegram update the Next.js `/api/telegram/webhook/[botId]`
//! route persists also lands here so operators can search, inspect, and
//! replay incidents from the dashboard.
//!
//! Mount under `/v1/telegram/webhooks`.

pub mod bot_api;
pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use bot_api::{BotApiClient, BotApiError};
pub use handlers::{enqueue_dlq, generate_secret_token, log_delivery, purge_old};
pub use state::TelegramWebhooksState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramWebhooksState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // -- Subscriptions ------------------------------------------------
        .route("/subscriptions", get(handlers::list_subscriptions))
        .route(
            "/subscriptions/{bot_id}",
            get(handlers::get_subscription)
                .put(handlers::put_subscription)
                .delete(handlers::delete_subscription),
        )
        .route(
            "/subscriptions/{bot_id}/test",
            post(handlers::test_subscription),
        )
        .route(
            "/subscriptions/{bot_id}/rotate-secret",
            post(handlers::rotate_secret),
        )
        // -- Deliveries ---------------------------------------------------
        .route(
            "/deliveries",
            get(handlers::list_deliveries).delete(handlers::delete_deliveries),
        )
        .route("/deliveries/log", post(handlers::log_delivery_route))
        .route("/deliveries/{id}", get(handlers::get_delivery))
        .route("/deliveries/{id}/replay", post(handlers::replay_delivery))
        // -- DLQ ----------------------------------------------------------
        .route("/dlq", get(handlers::list_dlq))
        .route("/dlq/enqueue", post(handlers::enqueue_dlq_route))
        .route("/dlq/{id}", delete(handlers::delete_dlq))
        .route("/dlq/{id}/retry", post(handlers::retry_dlq))
        .route("/dlq/{id}/resolve", post(handlers::resolve_dlq))
        // -- Analytics ----------------------------------------------------
        .route("/analytics", get(handlers::analytics))
}
