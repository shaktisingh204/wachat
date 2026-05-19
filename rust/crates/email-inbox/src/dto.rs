//! Wire DTOs (HTTP request / response shapes) the email-inbox router speaks.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to match
//! the JSON shape the TS client sends. Mongo documents are returned as
//! `serde_json::Value` (after the `bson_to_clean_json` pass) so the
//! router stays out of the way when the document shape evolves.
//!
//! Shapes mirror `src/lib/email/types.ts`:
//!   - [`EmailInboxThread`](crate::dto::ThreadDto)
//!   - [`EmailInboxMessage`](crate::dto::MessageDto)
//!   - [`EmailInboxAssignment`](crate::dto::AssignmentDto)

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Pagination + envelopes
// ---------------------------------------------------------------------------

fn default_page() -> u64 {
    1
}
fn default_limit() -> u64 {
    25
}
fn default_messages_limit() -> u64 {
    50
}

/// Filters for `GET /threads`. All fields are optional — absent filters
/// short-circuit to "no constraint" on the Mongo query.
///
/// `status` matches `EmailInboxThread.status` (`open|pending|closed|archived`).
/// `unread` and `starred` are booleans. `assignedTo`, `accountId` are hex
/// `ObjectId`s. `label` is matched against the `labels` array.
///
/// Pagination uses page / limit. We expose this rather than cursor-based
/// pagination so the TS layer can show "page N of M" UI; the cost of an
/// extra `count_documents` is acceptable on threads.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListThreadsQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub unread: Option<bool>,
    #[serde(default)]
    pub starred: Option<bool>,
    #[serde(default)]
    pub assigned_to: Option<String>,
    #[serde(default)]
    pub account_id: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
    /// Free-text contains-match on `subject` or `lastMessagePreview`.
    #[serde(default)]
    pub q: Option<String>,
}

/// `{ threads, total }` envelope for `GET /threads`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadListResponse {
    pub threads: Vec<Value>,
    pub total: u64,
}

/// Body for the `GET /threads/{id}` response — thread doc plus the
/// most-recent `messages` slice. The thread shape is the raw Mongo
/// document (so the TS layer sees every field declared on
/// `EmailInboxThread` in `src/lib/email/types.ts`).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadDetailResponse {
    pub thread: Value,
    pub messages: Vec<Value>,
}

/// `?limit=` query for the thread-detail message slice. Defaults to 25
/// — enough to render the bottom of the conversation without paginating
/// for the typical thread.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadDetailQuery {
    #[serde(default = "default_thread_detail_limit")]
    pub limit: u64,
}
fn default_thread_detail_limit() -> u64 {
    25
}

/// `?page=&limit=` query for the paginated message list under a thread.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListMessagesQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_messages_limit")]
    pub limit: u64,
}

/// `{ messages, total }` envelope for `GET /threads/{id}/messages`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageListResponse {
    pub messages: Vec<Value>,
    pub total: u64,
}

// ---------------------------------------------------------------------------
// PATCH /threads/{id} — partial update
// ---------------------------------------------------------------------------

/// Body for `PATCH /threads/{id}`. Every field is optional; only the
/// ones present in the request are written. Booleans use `Option<bool>`
/// (not `bool`) so the "absent" case is distinguishable from "set to
/// false".
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateThreadBody {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub unread: Option<bool>,
    #[serde(default)]
    pub starred: Option<bool>,
    /// Replace the labels array (set semantics — caller passes the full
    /// desired set).
    #[serde(default)]
    pub labels: Option<Vec<String>>,
    /// Set / clear assignedTo. `Some(None)` is not representable here; to
    /// release the assignment, hit the dedicated `DELETE
    /// /threads/{id}/assignments/{assignmentId}` endpoint.
    #[serde(default)]
    pub assigned_to: Option<String>,
    /// SLA deadline. RFC-3339 string; the handler parses it.
    #[serde(default)]
    pub sla_due_at: Option<String>,
}

/// `{ ok: true }` style envelope for mutations that don't return a
/// document.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OkResponse {
    pub ok: bool,
}

// ---------------------------------------------------------------------------
// POST /threads/bulk — bulk status update
// ---------------------------------------------------------------------------

/// Body for `POST /threads/bulk`. The TS UI does multi-select archive /
/// mark-read / mark-unread / star / unstar etc.; this captures all of
/// them in one envelope.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkUpdateThreadsBody {
    /// Hex `ObjectId` strings. Must be non-empty.
    pub thread_ids: Vec<String>,
    /// What to do. `"archive"` sets `status=archived`; `"close"` sets
    /// `status=closed`; `"reopen"` sets `status=open`; `"mark-read"` /
    /// `"mark-unread"` flips `unread`; `"star"` / `"unstar"` flips
    /// `starred`.
    pub action: String,
}

/// `{ updated }` — how many docs were touched by the bulk update. The
/// TS UI uses this to render a toast.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkUpdateResponse {
    pub updated: u64,
}

// ---------------------------------------------------------------------------
// POST /threads/{id}/messages — send reply
// ---------------------------------------------------------------------------

/// One recipient (mirrors `EmailRecipientAddress` from
/// `src/lib/email/types.ts`).
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipientDto {
    pub email: String,
    #[serde(default)]
    pub name: Option<String>,
}

/// One attachment (mirrors `EmailInboxMessage.attachments[]`).
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentDto {
    pub filename: String,
    pub content_type: String,
    pub size: i64,
    pub url: String,
}

/// Body for `POST /threads/{id}/messages`. The TS reply composer maps
/// directly to this shape. `bodyHtml` is the canonical body; `bodyText`
/// is optional plain-text fallback the SMTP layer will set automatically
/// if absent.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendReplyBody {
    /// Optional override; defaults to thread.subject prefixed with
    /// "Re: " if absent.
    #[serde(default)]
    pub subject: Option<String>,
    pub to: Vec<RecipientDto>,
    #[serde(default)]
    pub cc: Vec<RecipientDto>,
    #[serde(default)]
    pub bcc: Vec<RecipientDto>,
    #[serde(default)]
    pub body_text: Option<String>,
    pub body_html: String,
    #[serde(default)]
    pub attachments: Vec<AttachmentDto>,
}

/// `{ messageId }` — the new outbound message's `_id` (hex).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendReplyResponse {
    pub message_id: String,
}

// ---------------------------------------------------------------------------
// POST /threads/{id}/assign — create assignment
// ---------------------------------------------------------------------------

/// Body for `POST /threads/{id}/assign`. `assignedTo` is a hex `ObjectId`
/// referring to the user being assigned.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignThreadBody {
    pub assigned_to: String,
}

/// `{ assignmentId }` — the new `email_assignments._id`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignThreadResponse {
    pub assignment_id: String,
}

/// `{ assignments }` envelope for `GET /threads/{id}/assignments`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignmentsListResponse {
    pub assignments: Vec<Value>,
}
