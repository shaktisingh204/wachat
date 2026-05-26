//! # sabchat-teams
//!
//! Phase — axum router that owns the SabChat **teams, skill matrix, and
//! presence** HTTP surface. Mounted under `/v1/sabchat/teams` from the
//! orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/teams", sabchat_teams::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! The router drives three orthogonal but co-located concerns:
//!
//! 1. **Teams** — a named group of agents, optionally pinned to one or
//!    more inboxes. Used by routing rules for "round-robin over the
//!    sales team" and by the inbox UI for visibility filters.
//! 2. **Skills** — a flat skill catalog plus an agent ⇄ skill matrix
//!    with a 1..5 proficiency level. Consumed by the skill-based
//!    routing strategy in `sabchat-routing`.
//! 3. **Presence** — every agent's current availability
//!    (`online | away | busy | offline`). Set explicitly by the agent,
//!    by the HRM module (off-shift), or by the system (idle timeout).
//!
//! ## Collections
//!
//! | Collection                | Purpose                                |
//! |---------------------------|----------------------------------------|
//! | `sabchat_teams`           | One doc per team, with member + inbox arrays. |
//! | `sabchat_skills`          | Skill catalog (tenant-scoped).         |
//! | `sabchat_agent_skills`    | Per-agent skill rows with `level: 1..5`. |
//! | `sabchat_agent_presence`  | One row per agent — current status + audit. |
//!
//! ## Routes
//!
//! ```text
//! POST   /                              — create_team
//! GET    /                              — list_teams
//! GET    /{id}                          — get_team
//! PATCH  /{id}                          — update_team
//! DELETE /{id}                          — delete_team
//! POST   /{id}/members                  — add_team_member
//! DELETE /{id}/members/{agentId}        — remove_team_member
//! POST   /{id}/inboxes                  — add_team_inbox
//! DELETE /{id}/inboxes/{inboxId}        — remove_team_inbox
//!
//! POST   /skills                        — create_skill
//! GET    /skills                        — list_skills
//! GET    /skills/{id}                   — get_skill
//! PATCH  /skills/{id}                   — update_skill
//! DELETE /skills/{id}                   — delete_skill
//! POST   /skills/{skillId}/agents       — upsert_agent_skill
//! DELETE /skills/{skillId}/agents/{agentId} — remove_agent_skill
//! GET    /agents/{agentId}/skills       — list_agent_skills
//!
//! POST   /presence                      — set_presence (self)
//! GET    /presence                      — list_presence (tenant)
//! ```
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. All Mongo queries scope to `tenant_id` from the JWT — the
//! router never trusts a tenant-id off the wire.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. Handlers
//! need:
//!
//! - a [`SabChatTeamsState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, patch, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatTeamsState;

/// Build the SabChat teams + skills + presence router.
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatTeamsState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Route ordering note:** literal segments (`/skills`, `/presence`,
/// `/agents/...`) are registered before the `/{id}` patterns so axum's
/// matcher prefers the literal over the `{id}` parameter.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatTeamsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- skills sub-tree (literal — registered first) -------------
        .route(
            "/skills",
            post(handlers::create_skill).get(handlers::list_skills),
        )
        .route(
            "/skills/{id}",
            get(handlers::get_skill)
                .patch(handlers::update_skill)
                .delete(handlers::delete_skill),
        )
        .route(
            "/skills/{skill_id}/agents",
            post(handlers::upsert_agent_skill),
        )
        .route(
            "/skills/{skill_id}/agents/{agent_id}",
            delete(handlers::remove_agent_skill),
        )
        // ---- per-agent skill view (literal) ---------------------------
        .route(
            "/agents/{agent_id}/skills",
            get(handlers::list_agent_skills),
        )
        // ---- presence (literal) ---------------------------------------
        .route(
            "/presence",
            post(handlers::set_presence).get(handlers::list_presence),
        )
        // ---- teams collection root ------------------------------------
        .route(
            "/",
            post(handlers::create_team).get(handlers::list_teams),
        )
        // ---- per-team endpoints ---------------------------------------
        .route(
            "/{id}",
            get(handlers::get_team)
                .patch(handlers::update_team)
                .delete(handlers::delete_team),
        )
        .route(
            "/{id}/members",
            post(handlers::add_team_member),
        )
        .route(
            "/{id}/members/{agent_id}",
            delete(handlers::remove_team_member),
        )
        .route(
            "/{id}/inboxes",
            post(handlers::add_team_inbox),
        )
        .route(
            "/{id}/inboxes/{inbox_id}",
            delete(handlers::remove_team_inbox),
        )
}
