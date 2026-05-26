//! Wire-format DTOs for the SabChat inboxes endpoints.
//!
//! Every body / query / response uses `#[serde(rename_all =
//! "camelCase")]` so the JSON shape matches the Next.js shim. Stored
//! inbox documents are returned as `serde_json::Value` (rendered via
//! [`sabnode_db::document_to_clean_json`](sabnode_db::document_to_clean_json))
//! so the router stays out of the way when the underlying
//! [`SabChatInbox`](sabchat_types::SabChatInbox) shape evolves.

use sabchat_types::{BusinessHours, ChannelConfig};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// POST /v1/sabchat/inboxes — create_inbox
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/inboxes`. `channelType` is validated
/// against the snake-case
/// [`ChannelType`](sabchat_types::ChannelType) variant list; anything
/// else is rejected with [`ApiError::BadRequest`](sabnode_common::ApiError::BadRequest).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateInboxBody {
    pub name: String,
    /// Snake-case `ChannelType` discriminant (e.g. `"whatsapp_cloud"`,
    /// `"website"`, `"in_app"`).
    pub channel_type: String,
    #[serde(default)]
    pub channel_config: Option<ChannelConfig>,
    /// Optional hex `ObjectId` agent ids allowed to handle traffic on
    /// this inbox.
    #[serde(default)]
    pub agent_ids: Vec<String>,
    /// Optional hex `ObjectId` team id.
    #[serde(default)]
    pub team_id: Option<String>,
    #[serde(default)]
    pub business_hours: Option<BusinessHours>,
}

/// Response for `POST /v1/sabchat/inboxes` — returns the freshly
/// inserted inbox document with hex-rendered ids and ISO-8601 dates.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InboxResponse {
    #[schema(value_type = Object)]
    pub inbox: Value,
}

// ---------------------------------------------------------------------------
// GET /v1/sabchat/inboxes — list_inboxes
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/inboxes`. Filters compose
/// (channel type + enabled flag); omit any field to disable that
/// filter.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListInboxesQuery {
    /// Snake-case `ChannelType` discriminant. Validated identically to
    /// the create endpoint.
    #[serde(default)]
    pub channel_type: Option<String>,
    /// When set, restricts to enabled / disabled inboxes only. Soft-
    /// deleted inboxes (`enabled=false` + name prefixed with
    /// `"(deleted) "`) are returned only when `enabled=false` is
    /// explicitly requested.
    #[serde(default)]
    pub enabled: Option<bool>,
}

/// Response body for `GET /v1/sabchat/inboxes`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListInboxesResponse {
    #[schema(value_type = Vec<Object>)]
    pub inboxes: Vec<Value>,
    pub total: u64,
}

// ---------------------------------------------------------------------------
// PATCH /v1/sabchat/inboxes/{id} — update_inbox
// ---------------------------------------------------------------------------

/// Body for `PATCH /v1/sabchat/inboxes/{id}`. Every field is
/// optional — only the supplied fields are `$set`. Setting `teamId`
/// to `Some("")` clears the team binding (mirrors the legacy TS
/// "explicit null vs. omitted" contract).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInboxBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub channel_config: Option<ChannelConfig>,
    #[serde(default)]
    pub business_hours: Option<BusinessHours>,
    #[serde(default)]
    pub enabled: Option<bool>,
    /// Hex `ObjectId` team id; empty string clears the binding.
    #[serde(default)]
    pub team_id: Option<String>,
}

// ---------------------------------------------------------------------------
// POST /v1/sabchat/inboxes/{id}/agents — add_agent
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/inboxes/{id}/agents`. The handler uses
/// `$addToSet` so re-adding an existing agent is a no-op.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddAgentBody {
    /// Hex `ObjectId` agent id.
    pub agent_id: String,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by mutating endpoints that have
/// no other payload to return.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
