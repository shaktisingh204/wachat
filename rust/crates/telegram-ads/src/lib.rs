//! # telegram-ads
//!
//! Track Telegram Ad campaigns in our own database. The Telegram Ad
//! Platform (`ads.telegram.org`) does not expose a bot-side API, so
//! this crate only stores campaign metadata and link references the
//! operator copies from the platform UI.
//!
//! Mount under `/v1/telegram/ads`.

pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramAdsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramAdsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::upsert))
        .route("/analytics", get(handlers::analytics))
        .route("/import", post(handlers::import_csv))
        .route("/export", get(handlers::export_csv))
        .route("/bulk-delete", post(handlers::bulk_delete))
        .route("/utm", post(handlers::utm))
        .route(
            "/{campaign_id}",
            delete(handlers::delete_campaign).get(handlers::detail),
        )
}
