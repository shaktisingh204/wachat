//! Wire-format DTOs for the SabChat teams + skills + presence endpoints.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` so the
//! payloads match the camelCase JSON used by the Next.js side. Stored
//! documents are returned as `serde_json::Value` (rendered via
//! [`sabnode_db::document_to_clean_json`]) so the router stays out of
//! the way as document shapes evolve — same pattern used by the sister
//! `wachat-contacts` crate.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Teams — POST / PATCH bodies
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/teams` — create a new team.
///
/// `memberIds` and `inboxIds` may be supplied at create-time as a
/// convenience; otherwise the team starts empty and the dedicated
/// member / inbox endpoints are used to mutate the rosters.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateTeamBody {
    pub name: String,
    #[serde(default)]
    pub member_ids: Vec<String>,
    #[serde(default)]
    pub inbox_ids: Vec<String>,
}

/// Body for `PATCH /v1/sabchat/teams/{id}` — partial team update.
///
/// All fields optional — only provided fields are `$set`. Member / inbox
/// arrays go through the dedicated add / remove endpoints to keep the
/// audit story tight, so they are intentionally not patchable here.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTeamBody {
    #[serde(default)]
    pub name: Option<String>,
}

/// Body for `POST /v1/sabchat/teams/{id}/members` — add one agent to
/// the team's `memberIds` (uses `$addToSet`, so duplicates are a no-op).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddTeamMemberBody {
    pub agent_id: String,
}

/// Body for `POST /v1/sabchat/teams/{id}/inboxes` — attach one inbox.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddTeamInboxBody {
    pub inbox_id: String,
}

// ---------------------------------------------------------------------------
// Teams — responses
// ---------------------------------------------------------------------------

/// Response for `POST /v1/sabchat/teams`. Echoes the created hex id so
/// the caller can navigate without a follow-up GET.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateTeamResponse {
    pub team_id: String,
}

/// Response body for `GET /v1/sabchat/teams`. Returns the raw stored
/// documents (with ObjectIds rendered as hex strings and dates as ISO
/// 8601), letting the UI consume the existing `Team` shape directly.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTeamsResponse {
    #[schema(value_type = Vec<Object>)]
    pub teams: Vec<Value>,
}

/// Response body for `GET /v1/sabchat/teams/{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetTeamResponse {
    #[schema(value_type = Object)]
    pub team: Value,
}

// ---------------------------------------------------------------------------
// Skills — POST / PATCH bodies
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/teams/skills` — create a skill.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateSkillBody {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

/// Body for `PATCH /v1/sabchat/teams/skills/{id}` — partial skill
/// update. Either field optional; only provided fields are `$set`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSkillBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

// ---------------------------------------------------------------------------
// Skill matrix — agent ⇄ skill rows
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/teams/skills/{skillId}/agents` — upsert a
/// row in the agent ⇄ skill matrix. `level` is the proficiency on a
/// 1..5 scale (rejected outside that range).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpsertAgentSkillBody {
    pub agent_id: String,
    pub level: i32,
}

// ---------------------------------------------------------------------------
// Skills — responses
// ---------------------------------------------------------------------------

/// Response for `POST /v1/sabchat/teams/skills`. Echoes the new id.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateSkillResponse {
    pub skill_id: String,
}

/// Response body for `GET /v1/sabchat/teams/skills`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListSkillsResponse {
    #[schema(value_type = Vec<Object>)]
    pub skills: Vec<Value>,
}

/// Response body for `GET /v1/sabchat/teams/skills/{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetSkillResponse {
    #[schema(value_type = Object)]
    pub skill: Value,
}

/// Response body for `GET /v1/sabchat/teams/agents/{agentId}/skills`.
/// Each row carries the joined `skillId`, `level`, and timestamps —
/// callers that need the human-readable skill name follow up with the
/// skills listing.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListAgentSkillsResponse {
    #[schema(value_type = Vec<Object>)]
    pub skills: Vec<Value>,
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/teams/presence` — agent self-sets their
/// status. `set_by` is **always** "agent" on this path; the HRM /
/// system flows write directly through their own internal helper (not
/// exposed over this router).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetPresenceBody {
    /// One of "online" | "away" | "busy" | "offline".
    pub status: String,
}

/// Response body for `GET /v1/sabchat/teams/presence`. Returns one row
/// per agent in the calling tenant. Empty array if no presence rows
/// have been recorded yet.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListPresenceResponse {
    #[schema(value_type = Vec<Object>)]
    pub presence: Vec<Value>,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by every PATCH / DELETE / membership
/// mutation endpoint — matches the legacy TS server-action return type.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
