//! Wire DTOs for the wachat project-agents endpoints.
//!
//! `camelCase` to match the JSON the `/wachat/settings/agents` page
//! (and its `actions.ts`) sends. Field names mirror the legacy TS:
//! `wachatSettings.routingStrategy`, `agents.$.skills`, and the
//! `assignedAgentId` (string userId) stored on `contacts`.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Body for `POST /projects/{id}/agents/invite`.
///
/// Mirrors the `email` + `role` fields the `handleInviteAgent` form
/// submits. The project id comes from the path, not the body.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InviteAgentBody {
    /// Email of the user to invite/add as an agent.
    pub email: String,
    /// Role to assign on the project (`"agent"` or `"admin"`).
    pub role: String,
}

/// Body for `DELETE /projects/{id}/agents/{agentId}`.
///
/// `reassignToAgentId` is the user id (hex string) that inherits the
/// removed agent's open tickets. `None`/empty unassigns those tickets
/// (matches the TS `newAgentUserId === null` branch).
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RemoveAgentBody {
    /// Agent (user id) to reassign open tickets to. `None` unassigns them.
    #[serde(default)]
    pub reassign_to_agent_id: Option<String>,
}

/// Body for `PATCH /projects/{id}/routing`.
///
/// `routingStrategy` is written to `wachatSettings.routingStrategy` on
/// the project. Allowed values: `manual` | `round-robin` | `skill-based`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RoutingBody {
    /// New routing strategy.
    pub routing_strategy: String,
}

/// Body for `PUT /projects/{id}/agents/{agentId}/skills`.
///
/// Replaces the matched agent's `skills` array (`agents.$.skills`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SkillsBody {
    /// Full replacement skill set for the agent.
    #[serde(default)]
    pub skills: Vec<String>,
}

/// Response for `GET /projects/{id}/agents` — the project's embedded
/// `agents` array as cleaned JSON.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListAgentsResponse {
    #[schema(value_type = Vec<Object>)]
    pub agents: Vec<Value>,
}

/// Response for `GET /projects/{id}/agents/{agentId}/open-tickets`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct OpenTicketsResponse {
    /// Number of non-closed contacts assigned to the agent.
    pub count: u64,
}

/// Response for `POST /projects/{id}/agents/invite`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InviteAgentResponse {
    pub success: bool,
    /// Human-readable status (e.g. "Invitation sent to ...").
    pub message: String,
}

/// Generic `{ success: true }` envelope for the mutation endpoints.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
