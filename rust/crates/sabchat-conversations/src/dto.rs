//! Wire-format DTOs for the SabChat conversations endpoints.
//!
//! Each request body / query mirrors a single handler in
//! [`crate::handlers`]. Every shape uses `rename_all = "camelCase"` so
//! the JSON sent by the Next.js side round-trips cleanly.
//!
//! Stored documents are returned as `serde_json::Value` (rendered via
//! `document_to_clean_json`) so the router stays out of the way when
//! callers evolve the document shape.

use sabchat_types::{ConversationPriority, ConversationStatus};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Pagination defaults
// ---------------------------------------------------------------------------

/// Default page size for list endpoints. Mirrors Chatwoot's inbox UX.
pub const DEFAULT_LIMIT: i64 = 50;

/// Hard ceiling — protects against pathological large pages.
pub const MAX_LIMIT: i64 = 200;

// ---------------------------------------------------------------------------
// `POST /` — create_conversation
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/conversations`. The `priority` field
/// defaults to `medium` server-side when omitted; `customAttrs` is a
/// free-form blob copied verbatim onto the new document.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateConversationBody {
    /// Hex `ObjectId` of the owning inbox.
    pub inbox_id: String,
    /// Hex `ObjectId` of the resolved SabChat contact.
    pub contact_id: String,
    /// Optional priority — defaults to [`ConversationPriority::Medium`].
    #[serde(default)]
    pub priority: Option<ConversationPriority>,
    /// Optional free-form custom attributes bag.
    #[serde(default)]
    pub custom_attrs: Option<Value>,
}

// ---------------------------------------------------------------------------
// `GET /` — list_conversations
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/conversations`. All filters are
/// optional and AND-combined. Pagination is cursor-based; `cursor` is
/// the hex `ObjectId` of the last document on the previous page (sorted
/// by `lastMessageAt desc, _id desc`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListConversationsQuery {
    /// Restrict to one inbox.
    #[serde(default)]
    pub inbox_id: Option<String>,
    /// Restrict to one lifecycle status.
    #[serde(default)]
    pub status: Option<ConversationStatus>,
    /// Restrict to conversations assigned to one agent.
    #[serde(default)]
    pub assignee_id: Option<String>,
    /// Restrict to conversations carrying this label.
    #[serde(default)]
    pub label: Option<String>,
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

/// Response body for `GET /v1/sabchat/conversations`. `nextCursor` is
/// `None` once the listing is exhausted.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListConversationsResponse {
    #[schema(value_type = Vec<Object>)]
    pub conversations: Vec<Value>,
    /// Hex `ObjectId` of the last returned document; pass back as
    /// `cursor` to fetch the next page.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

// ---------------------------------------------------------------------------
// `PATCH /{id}/status` — update_status
// ---------------------------------------------------------------------------

/// Body for `PATCH /{id}/status` — moves the conversation between
/// lifecycle states. Transitions to [`ConversationStatus::Resolved`]
/// set `resolvedAt = now`; transitions to [`ConversationStatus::Open`]
/// clear `resolvedAt`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatusBody {
    pub status: ConversationStatus,
}

// ---------------------------------------------------------------------------
// `PATCH /{id}/priority` — update_priority
// ---------------------------------------------------------------------------

/// Body for `PATCH /{id}/priority`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePriorityBody {
    pub priority: ConversationPriority,
}

// ---------------------------------------------------------------------------
// `PATCH /{id}/assignee` — update_assignee
// ---------------------------------------------------------------------------

/// Body for `PATCH /{id}/assignee`. `assigneeId == None` (or `null`)
/// clears the assignment. `reason` is forwarded onto the
/// `sabchat_assignments` history row.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAssigneeBody {
    #[serde(default)]
    pub assignee_id: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
}

// ---------------------------------------------------------------------------
// `POST /{id}/labels` — add_label
// ---------------------------------------------------------------------------

/// Body for `POST /{id}/labels`. Uses `$addToSet` so duplicate calls
/// are idempotent.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddLabelBody {
    pub label: String,
}

// ---------------------------------------------------------------------------
// `POST /{id}/snooze` — snooze_conversation
// ---------------------------------------------------------------------------

/// Body for `POST /{id}/snooze`. Sets `status = Snoozed` and stores
/// `snoozeUntil = until` (RFC3339).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SnoozeBody {
    /// RFC3339 wall-clock instant at which the conversation should
    /// auto-reopen. Parsed server-side.
    pub until: String,
}

// ---------------------------------------------------------------------------
// Generic conversation response
// ---------------------------------------------------------------------------

/// Envelope returned by every handler that hands back a single
/// conversation document. The inner shape mirrors
/// [`sabchat_types::SabChatConversation`] after `document_to_clean_json`
/// rendering (ObjectIds as hex, DateTimes as ISO 8601).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConversationResponse {
    #[schema(value_type = Object)]
    pub conversation: Value,
}
