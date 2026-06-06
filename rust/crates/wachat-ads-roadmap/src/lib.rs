//! # wachat_ads_roadmap
//!
//! Axum router for the `/wachat/whatsapp-ads/roadmap` page: the public
//! Meta-Marketing-API integration roadmap. Mounted under
//! `/v1/wachat/ads-roadmap`:
//!
//! ```ignore
//! .nest("/v1/wachat/ads-roadmap", wachat_ads_roadmap::router::<AppState>())
//! ```
//!
//! Phases are global (one shared plan), stored in `wa_ads_roadmap_phases`.
//! Upvotes live in `wa_ads_roadmap_votes`, scoped + deduped by the
//! authenticated user. Generic over the caller's state `S`; needs a
//! [`WachatAdsRoadmapState`] and the JWT verifier config, both pulled via
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

pub use state::WachatAdsRoadmapState;

/// Build the ads-roadmap router (caller nests under `/v1/wachat/ads-roadmap`).
///
/// ```text
/// GET  /phases                — list_phases (global, with aggregated votes)
/// POST /phases/{phase}/vote   — vote_phase (idempotent per-user upvote)
/// POST /sync                  — sync (stub; no external PM configured)
/// ```
///
/// Literal segments are registered before `{param}` segments per axum 0.8.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatAdsRoadmapState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/phases", get(handlers::list_phases))
        .route("/phases/{phase}/vote", post(handlers::vote_phase))
        .route("/sync", post(handlers::sync))
}
