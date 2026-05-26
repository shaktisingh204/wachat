//! # sabchat-gamification
//!
//! Phase — axum router that owns the SabChat **gamification** surface:
//! agent leaderboards, badges, streaks. Mounted under
//! `/v1/sabchat/gamification` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/gamification", sabchat_gamification::router::<AppState>())
//! ```
//!
//! ## Data sources
//!
//! Reads tenant-scoped from:
//!
//! - `sabchat_conversations` — resolved-count + first-response latency
//! - `sabchat_messages`      — (reserved for future per-message scoring)
//! - `sabchat_survey_responses` — CSAT score → bonus points
//!
//! Writes:
//!
//! - `sabchat_badges`        — tenant catalogue of badge definitions
//! - `sabchat_agent_badges`  — per-agent awarded-badge ledger (unique
//!                             on `(tenantId, agentId, badgeCode)`)
//! - `sabchat_agent_points`  — per-(period_key, agent) leaderboard row
//!
//! ## HTTP surface
//!
//! | Method | Path                                  | Handler                              |
//! |--------|---------------------------------------|--------------------------------------|
//! | POST   | `/badges`                             | [`handlers::create_badge`]           |
//! | GET    | `/badges`                             | [`handlers::list_badges`]            |
//! | PATCH  | `/badges/{id}`                        | [`handlers::update_badge`]           |
//! | DELETE | `/badges/{id}`                        | [`handlers::delete_badge`]           |
//! | POST   | `/award`                              | [`handlers::award_badge`]            |
//! | GET    | `/leaderboard?period=&limit=&since=`  | [`handlers::leaderboard`]            |
//! | GET    | `/agents/{agentId}/badges`            | [`handlers::agent_badges`]           |
//! | GET    | `/agents/{agentId}/stats?period=`     | [`handlers::agent_stats`]            |
//! | POST   | `/recompute`                          | [`handlers::recompute`]              |
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires [`AuthUser`](sabnode_auth::AuthUser) and
//! filters by `tenantId == ObjectId::parse_str(&auth.tenant_id)`. A
//! malformed `tid` claim returns `401 Unauthorized`. There is no
//! cross-tenant gamification view.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatGamificationState`] bundle (Mongo handle), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub(crate) mod scoring;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, patch, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatGamificationState;

// ---------------------------------------------------------------------------
// Collection names — kept in one place so handlers + scoring agree on
// the wire-level identifiers without stringly-typed drift.
// ---------------------------------------------------------------------------

/// `sabchat_conversations` — source of resolved-conversation counts +
/// first-response latency averages.
pub(crate) const CONVERSATIONS_COLL: &str = "sabchat_conversations";

/// `sabchat_survey_responses` — CSAT scores feed the +5 / +3 bonus.
pub(crate) const SURVEY_RESPONSES_COLL: &str = "sabchat_survey_responses";

/// `sabchat_badges` — tenant catalogue of badge definitions.
pub(crate) const BADGES_COLL: &str = "sabchat_badges";

/// `sabchat_agent_badges` — per-agent ledger of awarded badges.
pub(crate) const AGENT_BADGES_COLL: &str = "sabchat_agent_badges";

/// `sabchat_agent_points` — per-(period, agent) leaderboard row.
pub(crate) const AGENT_POINTS_COLL: &str = "sabchat_agent_points";

/// Build the SabChat gamification router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/gamification`):
///
/// ```text
/// POST   /badges                       — create_badge
/// GET    /badges                       — list_badges
/// PATCH  /badges/{id}                  — update_badge
/// DELETE /badges/{id}                  — delete_badge
/// POST   /award                        — award_badge (idempotent upsert)
/// GET    /leaderboard                  — leaderboard
/// GET    /agents/{agentId}/badges      — agent_badges
/// GET    /agents/{agentId}/stats       — agent_stats
/// POST   /recompute                    — recompute (admin)
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatGamificationState`] bundle and the JWT verifier config;
/// both are pulled via [`FromRef`] so the router does not have to know
/// about a concrete monolithic state struct.
///
/// **Route ordering note:** literal segments (`/award`, `/recompute`,
/// `/leaderboard`, `/badges`) are registered before the parameterised
/// `/agents/{agentId}/*` routes so axum's matcher picks the literal
/// first.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatGamificationState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- badge catalogue ------------------------------------------
        .route(
            "/badges",
            post(handlers::create_badge).get(handlers::list_badges),
        )
        .route(
            "/badges/{id}",
            patch(handlers::update_badge).delete(handlers::delete_badge),
        )
        // ---- manual award --------------------------------------------
        .route("/award", post(handlers::award_badge))
        // ---- leaderboard ---------------------------------------------
        .route("/leaderboard", get(handlers::leaderboard))
        // ---- agent views ---------------------------------------------
        .route("/agents/{agent_id}/badges", get(handlers::agent_badges))
        .route("/agents/{agent_id}/stats", get(handlers::agent_stats))
        // ---- admin recompute -----------------------------------------
        .route("/recompute", post(handlers::recompute))
}
