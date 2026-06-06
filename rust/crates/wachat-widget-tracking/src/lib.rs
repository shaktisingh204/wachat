//! # wachat-widget-tracking
//!
//! Axum router for the WhatsApp **chat-widget** feature on the
//! `/wachat/integrations/whatsapp-widget-generator` page: per-project
//! widget analytics (loads / opens / clicks) and advanced widget
//! behaviour settings. Mounted under `/v1/wachat/widget`:
//!
//! ```ignore
//! .nest("/v1/wachat/widget", wachat_widget_tracking::router::<AppState>())
//! ```
//!
//! All counters and settings live on the **real** `projects` collection
//! under `widgetSettings` (`stats` for analytics, `advanced` for the new
//! behaviour knobs). Generic over the caller's state `S`; needs a
//! [`WachatWidgetTrackingState`] and the JWT verifier config, both pulled
//! via [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post, put},
};
use sabnode_auth::AuthConfig;

pub use state::WachatWidgetTrackingState;

/// Build the widget-tracking router (caller nests under `/v1/wachat/widget`).
///
/// ```text
/// GET  /{project_id}/stats              — get_stats
/// POST /{project_id}/track              — track_event
/// PUT  /{project_id}/advanced-settings  — update_advanced_settings
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatWidgetTrackingState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/{project_id}/stats", get(handlers::get_stats))
        .route("/{project_id}/track", post(handlers::track_event))
        .route(
            "/{project_id}/advanced-settings",
            put(handlers::update_advanced_settings),
        )
}
