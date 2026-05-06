//! # telegram-payments
//!
//! Manage Telegram invoices (Stars + provider) and process Star refunds.
//! Mount under `/v1/telegram/payments`.

pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramPaymentsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramPaymentsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::create))
        .route("/refund", post(handlers::refund))
}
