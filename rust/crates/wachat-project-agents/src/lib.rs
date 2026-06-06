//! # wachat-project-agents
//!
//! Axum router for the `/wachat/settings/agents` page: the per-project
//! **agents, roles & routing** surface. Mounted under
//! `/v1/wachat/project-agents`:
//!
//! ```ignore
//! .nest("/v1/wachat/project-agents", wachat_project_agents::router::<AppState>())
//! ```
//!
//! Operates on two REAL collections (no `wa_*` collection is invented —
//! the data already exists):
//! - `projects` — embeds the `agents` array + `wachatSettings.routingStrategy`.
//! - `contacts` — carries `assignedAgentId` (string userId) + `status`.
//!
//! Migrates `src/app/wachat/settings/agents/actions.ts` plus the invite
//! half of `handleInviteAgent` (project-scoped add of an existing user).
//! Every query is scoped to the authenticated owner of the project.
//! Generic over the caller's state `S`; needs a
//! [`WachatProjectAgentsState`] and the JWT verifier config, both pulled
//! via [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, patch, post, put},
};
use sabnode_auth::AuthConfig;

pub use state::WachatProjectAgentsState;

/// Build the project-agents router (caller nests under
/// `/v1/wachat/project-agents`).
///
/// ```text
/// GET    /projects/{id}/agents                         — list_agents
/// POST   /projects/{id}/agents/invite                  — invite_agent
/// GET    /projects/{id}/agents/{agentId}/open-tickets  — open_tickets
/// DELETE /projects/{id}/agents/{agentId}               — remove_agent
/// PATCH  /projects/{id}/routing                        — update_routing
/// PUT    /projects/{id}/agents/{agentId}/skills        — update_skills
/// ```
///
/// Literal segments (`/agents`, `/invite`, `/routing`, `/skills`,
/// `/open-tickets`) sit before/around the `{id}` / `{agentId}` params,
/// per the axum 0.8 `/{param}` matcher.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatProjectAgentsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/projects/{id}/agents", get(handlers::list_agents))
        .route(
            "/projects/{id}/agents/invite",
            post(handlers::invite_agent),
        )
        .route(
            "/projects/{id}/agents/{agentId}/open-tickets",
            get(handlers::open_tickets),
        )
        .route(
            "/projects/{id}/agents/{agentId}",
            delete(handlers::remove_agent),
        )
        .route(
            "/projects/{id}/agents/{agentId}/skills",
            put(handlers::update_skills),
        )
        .route("/projects/{id}/routing", patch(handlers::update_routing))
}
