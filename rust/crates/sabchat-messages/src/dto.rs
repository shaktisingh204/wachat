//! Wire-format DTOs for the SabChat messages endpoints.
//!
//! Bodies and query strings use `#[serde(rename_all = "camelCase")]` to
//! match the JSON the Next.js shim sends. Stored documents are returned
//! as `serde_json::Value` so the router stays out of the way when the
//! `sabchat_messages` document shape evolves.

use sabchat_types::content::ContentBlock;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Defaults / limits
// ---------------------------------------------------------------------------

/// Default page size for the list endpoint when the client omits
/// `limit`. Mirrors the inbox rendering window.
pub const DEFAULT_LIST_LIMIT: i64 = 50;

/// Hard ceiling on `limit` for the list endpoint. Anything above this is
/// clamped — we never want a single page-load to drag the entire history.
pub const MAX_LIST_LIMIT: i64 = 200;

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/messages` — append
// ---------------------------------------------------------------------------

/// Sender taxonomy accepted on the append wire. Mirrors the subset of
/// [`sabchat_types::SenderType`] that callers may explicitly assert from
/// the HTTP edge — `system` notes are written by side-effect handlers,
/// not via this endpoint.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AppendSenderType {
    Agent,
    Bot,
    Visitor,
}

/// Body for `POST /v1/sabchat/messages` — append one message to a
/// conversation. The router resolves `inboxId`, `contactId`, and
/// `tenantId` from the parent conversation document.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AppendMessageBody {
    /// Hex `ObjectId` of the parent conversation.
    pub conversation_id: String,
    /// Rich content block to persist. Discriminated union — see
    /// [`ContentBlock`].
    #[schema(value_type = Object)]
    pub content: ContentBlock,
    /// Internal-note flag. Private messages do not move the
    /// conversation's preview / unread counters.
    #[serde(default)]
    pub private: bool,
    /// Who is sending — `agent`, `bot`, or `visitor` (admin override).
    pub sender_type: AppendSenderType,
    /// Optional explicit sender id. When omitted we fall back to
    /// `auth.user_id` for `agent`, and leave `None` for `bot` / `visitor`.
    #[serde(default)]
    pub sender_id: Option<String>,
}

/// Response envelope for `POST /v1/sabchat/messages`. Returns the freshly
/// persisted message document (with ObjectIds rendered as hex strings).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AppendMessageResponse {
    #[schema(value_type = Object)]
    pub message: Value,
}

// ---------------------------------------------------------------------------
// `GET /v1/sabchat/messages` — list
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/messages`. Newest-first pagination
/// uses an opaque `beforeId` cursor (the `_id` hex of the oldest message
/// already rendered on the client).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListMessagesQuery {
    /// Required — hex `ObjectId` of the conversation to scope to. The
    /// conversation must belong to the caller's tenant.
    pub conversation_id: String,
    /// Optional cursor — return messages with `_id < beforeId`. Omit on
    /// the first page.
    #[serde(default)]
    pub before_id: Option<String>,
    /// Page size. Defaults to [`DEFAULT_LIST_LIMIT`]; clamped to
    /// [`MAX_LIST_LIMIT`].
    #[serde(default)]
    pub limit: Option<i64>,
}

/// Response body for `GET /v1/sabchat/messages`. Returns the raw stored
/// documents (ObjectIds as hex, dates as ISO 8601) so the caller can
/// drive existing UI that already understands [`sabchat_types::SabChatMessage`].
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListMessagesResponse {
    #[schema(value_type = Vec<Object>)]
    pub messages: Vec<Value>,
}

// ---------------------------------------------------------------------------
// `GET /v1/sabchat/messages/:id` — get_one
// ---------------------------------------------------------------------------

/// Response body for `GET /v1/sabchat/messages/:id`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetMessageResponse {
    #[schema(value_type = Object)]
    pub message: Value,
}

// ---------------------------------------------------------------------------
// `PATCH /v1/sabchat/messages/:id` — edit
// ---------------------------------------------------------------------------

/// Body for `PATCH /v1/sabchat/messages/:id`. Replaces the message's
/// content block. The handler enforces a 15-minute edit window and
/// rejects edits from anyone other than the original sender.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EditMessageBody {
    /// New content block. Discriminated union — see [`ContentBlock`].
    #[schema(value_type = Object)]
    pub content: ContentBlock,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by mutation endpoints that have no
/// other useful body to return.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
