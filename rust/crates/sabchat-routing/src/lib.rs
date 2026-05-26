//! # sabchat-routing
//!
//! Phase — axum router that owns the **conversation-routing** HTTP surface
//! for SabChat. Mounted under `/v1/sabchat/routing` from the orchestrating
//! `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/routing", sabchat_routing::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! Three concerns live here:
//!
//! | HTTP route                                          | Handler                |
//! |-----------------------------------------------------|------------------------|
//! | `POST /assign/{conversationId}`                     | apply an assignment    |
//! | `POST /sla/sweep`                                   | recompute `sla.breached` |
//! | `GET  /load`                                        | per-agent load report  |
//!
//! ## Assignment strategies
//!
//! Four strategies, selected by the `strategy` field on the request body:
//!
//! - **`round_robin`** — pick the inbox agent with the fewest open
//!   conversations on this inbox; ties broken by least-recently assigned in
//!   `sabchat_assignments`.
//! - **`manual`** — caller supplies `agentId`; verified against the
//!   inbox's `agent_ids`. A non-member agent returns 403.
//! - **`sticky`** — re-use the contact's most recent assignee if still on
//!   the inbox; otherwise fall back to round-robin transparently.
//! - **`unassign`** — clear `assignee_id` on the conversation.
//!
//! ## Collections touched
//!
//! | Op    | Collection               | Purpose                                  |
//! |-------|--------------------------|------------------------------------------|
//! | read  | `sabchat_inboxes`        | resolve `agent_ids` for an inbox         |
//! | read  | `sabchat_conversations`  | load conversation, open counts, sweep    |
//! | read  | `sabchat_assignments`    | last-assigned tiebreak, sticky lookup    |
//! | write | `sabchat_conversations`  | `assignee_id`, `sla.breached`, `updatedAt` |
//! | write | `sabchat_assignments`    | append assignment history row            |
//! | write | `sabchat_audit_log`      | `conversation_assigned` event            |
//!
//! ## Tenancy
//!
//! Every operation scopes by `ObjectId::parse_str(&auth.tenant_id)` — the
//! JWT claim is the only source of truth. RBAC (admin-only `/sla/sweep`,
//! etc.) is enforced at the orchestrator level so this crate stays role-
//! agnostic and can be re-used inside SabFlow auto-routing nodes.
//!
//! ## Public library surface
//!
//! In addition to the router, this crate exposes [`next_round_robin_agent`]
//! so non-HTTP callers (most notably SabFlow nodes that auto-assign on
//! incoming messages) can pick the next agent with the exact same logic the
//! HTTP layer uses, without spinning up axum.

pub mod dto;
pub mod handlers;
pub mod state;
mod strategy;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use bson::oid::ObjectId;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

pub use state::SabChatRoutingState;

/// Build the SabChat routing router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/routing`):
///
/// ```text
/// POST /assign/{conversationId}   — apply an assignment strategy
/// POST /sla/sweep                 — admin / cron SLA recomputation
/// GET  /load                      — per-agent capacity report
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatRoutingState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about the
/// orchestrator's concrete `AppState`.
///
/// **Route ordering note:** literal segments (`/sla/sweep`, `/load`) are
/// registered separately from the `/assign/{id}` parameter route so axum's
/// matcher has no ambiguity.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatRoutingState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/assign/{conversationId}", post(handlers::assign))
        .route("/sla/sweep", post(handlers::sla_sweep))
        .route("/load", get(handlers::agent_load))
}

/// Pick the next agent for the given inbox using round-robin selection.
///
/// Returns `None` if the inbox has no agents. This is the same selection
/// path the `assign` HTTP handler uses with `strategy = round_robin`, so
/// library callers (SabFlow nodes, background workers) get bit-for-bit
/// identical behaviour without going through axum.
///
/// Tenant scope is mandatory — `tenant_id` filters both the inbox lookup
/// and the open-conversation counts that drive the selection.
pub async fn next_round_robin_agent(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    inbox_id: ObjectId,
) -> anyhow::Result<Option<ObjectId>> {
    let agents = strategy::load_inbox_agents(mongo, tenant_id, inbox_id)
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    strategy::pick_round_robin(mongo, tenant_id, inbox_id, &agents)
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))
}
