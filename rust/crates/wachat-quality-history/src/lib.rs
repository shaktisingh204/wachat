//! # wachat-quality-history
//!
//! Axum router for the `/wachat/health` page's per-number quality time-series.
//! Mounted under `/v1/wachat/quality-history`:
//!
//! ```ignore
//! .nest("/v1/wachat/quality-history", wachat_quality_history::router::<AppState>())
//! ```
//!
//! Stores and serves quality-rating snapshots from `wa_phone_quality_history`,
//! scoped to the authenticated user (`userId`) and a `phoneNumberId`. Reads
//! return an honest empty array when there is no history (never mock data).
//! Generic over the caller's state `S`; needs a [`WachatQualityHistoryState`]
//! and the JWT verifier config, both pulled via
//! [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatQualityHistoryState;

/// Build the quality-history router (caller nests under `/v1/wachat/quality-history`).
///
/// ```text
/// GET  /{phoneNumberId}            — list_snapshots  (sorted by date asc, [] when none)
/// POST /{phoneNumberId}/snapshot   — create_snapshot (record {rating, event?})
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatQualityHistoryState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/{phone_number_id}", get(handlers::list_snapshots))
        .route(
            "/{phone_number_id}/snapshot",
            post(handlers::create_snapshot),
        )
}
