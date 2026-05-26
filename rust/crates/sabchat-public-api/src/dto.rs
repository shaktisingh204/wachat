//! Wire-format DTOs for the SabChat public-API endpoints.
//!
//! These shapes are intentionally a **strict subset** of the agent-side
//! routers' DTOs so the API-key surface is easy to document and stable
//! over time. Agent-only knobs (priority, assignee, audit-only fields,
//! …) are not exposed here.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to match
//! the JSON shape the Next.js side and external partners send.
//!
//! ## What ships on the wire
//!
//! - **Contacts**: full [`SabChatContact`] documents (the public-API
//!   reads the same Mongo collection the agent UI does).
//! - **Conversations**: rendered as `serde_json::Value` so the document
//!   shape can evolve without breaking the wire — same convention used
//!   by `sabchat-conversations`.
//! - **Messages**: rendered as `serde_json::Value` for the same reason.

use sabchat_types::{ContentBlock, ConversationStatus, SabChatContact, SocialIdentity};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Pagination defaults
// ---------------------------------------------------------------------------

/// Default page size for every public-API list endpoint.
pub const DEFAULT_LIMIT: i64 = 50;

/// Hard ceiling so callers cannot DOS the server with `limit=1_000_000`.
pub const MAX_LIMIT: i64 = 200;

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

/// Required scope for every read endpoint on the SabChat public-API.
pub const SCOPE_READ: &str = "sabchat:read";

/// Required scope for every write endpoint on the SabChat public-API.
pub const SCOPE_WRITE: &str = "sabchat:write";

// ===========================================================================
// Contacts
// ===========================================================================

/// Query string for `GET /v1/sabchat/public/contacts`. All filters are
/// optional and AND-combined. Pagination is cursor-based; `cursor` is
/// the hex `_id` of the last document on the previous page.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListContactsQuery {
    /// Case-insensitive substring match against `name`, `emails`,
    /// `phones`. Missing / empty disables search.
    #[serde(default)]
    pub q: Option<String>,
    /// Exact tag-name filter. Missing / empty disables the filter.
    #[serde(default)]
    pub tag: Option<String>,
    /// Page size — defaults to [`DEFAULT_LIMIT`], capped at [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<i64>,
    /// Cursor = hex `_id` of the last document on the previous page.
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response body for `GET /v1/sabchat/public/contacts`. `nextCursor` is
/// `None` once the listing is exhausted.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListContactsResponse {
    pub items: Vec<SabChatContact>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

/// Response envelope wrapping a single SabChat contact.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ContactResponse {
    pub contact: SabChatContact,
}

/// Body for `POST /v1/sabchat/public/contacts`. Identifier-less
/// contacts (no email, no phone, no social id) are rejected with
/// `BadRequest` — same rule the agent-side `sabchat-contacts` router
/// enforces.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateContactBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub emails: Vec<String>,
    #[serde(default)]
    pub phones: Vec<String>,
    #[serde(default)]
    pub social_ids: Vec<SocialIdentity>,
    /// Free-form custom attributes bag. Opaque to the server.
    #[serde(default)]
    pub attrs: Option<Value>,
    #[serde(default)]
    pub tags: Vec<String>,
}

// ===========================================================================
// Conversations
// ===========================================================================

/// Query string for `GET /v1/sabchat/public/conversations`. All filters
/// are optional and AND-combined.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListConversationsQuery {
    /// Restrict to one inbox.
    #[serde(default)]
    pub inbox_id: Option<String>,
    /// Restrict to one lifecycle status.
    #[serde(default)]
    pub status: Option<ConversationStatus>,
    /// Case-insensitive substring match against `lastMessagePreview`.
    #[serde(default)]
    pub q: Option<String>,
    /// Page size — defaults to [`DEFAULT_LIMIT`], capped at [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<i64>,
    /// Cursor = hex `_id` of the last document on the previous page.
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response body for `GET /v1/sabchat/public/conversations`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListConversationsResponse {
    #[schema(value_type = Vec<Object>)]
    pub conversations: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

/// Response envelope wrapping a single rendered conversation.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConversationResponse {
    #[schema(value_type = Object)]
    pub conversation: Value,
}

// ===========================================================================
// Messages
// ===========================================================================

/// Query string for `GET /v1/sabchat/public/conversations/{id}/messages`.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListMessagesQuery {
    /// Reverse-chronological cursor — return messages with `_id <
    /// beforeId`. Missing / empty starts from the newest message.
    #[serde(default)]
    pub before_id: Option<String>,
    /// Page size — defaults to [`DEFAULT_LIMIT`], capped at [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<i64>,
}

/// Response body for the messages list endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListMessagesResponse {
    #[schema(value_type = Vec<Object>)]
    pub messages: Vec<Value>,
}

/// Body for `POST /v1/sabchat/public/conversations/{id}/messages`. The
/// public-API surface always writes messages as `senderType == "bot"`
/// (the API-key context is by definition a programmatic actor, not a
/// human agent or the visitor).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AppendMessageBody {
    /// The content block to append. Same shape as
    /// [`sabchat_types::ContentBlock`].
    pub content: ContentBlock,
    /// Optional sender id (typically a bot id). The server does NOT
    /// fall back to anything if this is omitted — the field is purely
    /// for traceability.
    #[serde(default)]
    pub sender_id: Option<String>,
    /// `private` notes are agent-internal and never shown to the
    /// visitor. Defaults to `false`.
    #[serde(default)]
    pub private: bool,
}

/// Response envelope for `POST /…/messages`. Returns the inserted
/// document so callers don't need a follow-up GET.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AppendMessageResponse {
    #[schema(value_type = Object)]
    pub message: Value,
}
