//! Wire-format DTOs for the SabChat routing endpoints.
//!
//! All bodies / responses use `#[serde(rename_all = "camelCase")]` to match
//! the JSON the Next.js shim sends and consumes.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// POST /v1/sabchat/routing/assign/{conversationId}
// ---------------------------------------------------------------------------

/// Assignment strategy discriminator. Stable wire values — do not rename
/// without a migration to `sabchat_assignments.reason`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AssignStrategy {
    /// Pick the inbox agent with the fewest open conversations on this inbox;
    /// ties broken by least-recently assigned in `sabchat_assignments`.
    RoundRobin,
    /// Caller-supplied `agentId` (must belong to the inbox's `agent_ids`).
    Manual,
    /// Re-use the contact's previous assignee if still on the inbox; else
    /// fall back to round-robin.
    Sticky,
    /// Clear `assignee_id` on the conversation.
    Unassign,
}

/// Body for `POST /v1/sabchat/routing/assign/{conversationId}`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AssignReq {
    pub strategy: AssignStrategy,
    /// Required when `strategy == manual`. Hex `ObjectId` string of the
    /// target agent. Ignored otherwise.
    #[serde(default)]
    pub agent_id: Option<String>,
    /// Optional free-form reason recorded on the assignment history row;
    /// when absent we record the strategy discriminant verbatim.
    #[serde(default)]
    pub reason: Option<String>,
}

/// Response envelope for `POST /v1/sabchat/routing/assign/{conversationId}`.
///
/// Returns the resolved assignee (or `None` for the `unassign` strategy) so
/// the caller doesn't need a follow-up read of the conversation document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AssignResp {
    pub conversation_id: String,
    /// Strategy that was applied (echoed for the caller's logging).
    pub strategy: AssignStrategy,
    /// New assignee hex `ObjectId` — `None` when the conversation was
    /// unassigned (or when round-robin / sticky had nobody to pick).
    #[serde(default)]
    pub assignee_id: Option<String>,
    /// Previous assignee, useful for UI diffing without an extra read.
    #[serde(default)]
    pub previous_assignee_id: Option<String>,
}

// ---------------------------------------------------------------------------
// POST /v1/sabchat/routing/sla/sweep
// ---------------------------------------------------------------------------

/// Response for `POST /v1/sabchat/routing/sla/sweep`. The sweep walks all
/// `open` conversations of the tenant and recomputes the cached
/// `sla.breached` flag.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SlaSweepResp {
    /// Total open conversations inspected.
    pub scanned: u64,
    /// How many `sla.breached = true` writes were performed.
    pub newly_breached: u64,
    /// How many conversations were transitioned back to `sla.breached = false`
    /// (e.g. after due-dates were extended).
    pub cleared: u64,
    /// How many already-correct documents needed no write.
    pub unchanged: u64,
}

// ---------------------------------------------------------------------------
// GET /v1/sabchat/routing/load
// ---------------------------------------------------------------------------

/// One row in the agent-load report. Used by the inbox UI to display per-
/// agent capacity.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AgentLoadRow {
    /// Hex `ObjectId` string of the agent.
    pub agent_id: String,
    /// Number of `open` conversations currently assigned to this agent in
    /// this tenant.
    pub open_count: u64,
    /// Of those, how many are `priority == urgent`.
    pub urgent_count: u64,
    /// Age of the oldest open conversation assigned to this agent, in whole
    /// minutes (rounded down). `None` if the agent has no open work.
    #[serde(default)]
    pub oldest_minutes: Option<i64>,
}
