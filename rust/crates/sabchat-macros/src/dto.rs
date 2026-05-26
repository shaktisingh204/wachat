//! Wire-format DTOs for the SabChat macros endpoints.
//!
//! Stored documents are returned as `serde_json::Value` (rendered via
//! `document_to_clean_json`) so the router stays out of the way when
//! callers evolve the document shape — same approach as the sibling
//! `sabchat-conversations` router.
//!
//! All bodies / queries use `rename_all = "camelCase"` so JSON from the
//! Next.js side round-trips cleanly. The [`MacroStep`] enum is tagged by
//! `kind` in snake_case to match the shape the rest of the SabChat
//! module already uses (see [`sabchat_types::ContentBlock`]).

use sabchat_types::{ContentBlock, ConversationPriority, ConversationStatus};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Pagination defaults
// ---------------------------------------------------------------------------

/// Default page size for [`list_macros`](crate::handlers::list_macros).
pub const DEFAULT_LIMIT: i64 = 50;

/// Hard ceiling — protects against pathological large pages.
pub const MAX_LIMIT: i64 = 200;

// ---------------------------------------------------------------------------
// MacroStep — the executable unit of a macro
// ---------------------------------------------------------------------------

/// One step in a macro. Tagged by `kind` in snake_case so the wire shape
/// is `{ "kind": "send_message", "content": { ... }, "private": false }`.
///
/// `send_message` carries a full [`ContentBlock`] so callers can fire
/// rich payloads (cards, carousels, …) as easily as a plain `text`
/// block. `{{var}}` interpolation is applied to the textual fields of
/// the block at run-time — see [`crate::template::interpolate`].
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum MacroStep {
    /// Append a message to the conversation. If `private` is `true` the
    /// message is recorded as a private note (visible to agents only).
    SendMessage {
        content: ContentBlock,
        #[serde(default)]
        private: bool,
    },
    /// `$addToSet` a label on the conversation.
    AddLabel { label: String },
    /// `$pull` a label from the conversation.
    RemoveLabel { label: String },
    /// Set the conversation lifecycle status. Transition side-effects
    /// (e.g. `resolvedAt` on `resolved`) are applied in the executor.
    SetStatus { status: ConversationStatus },
    /// Set the conversation priority.
    SetPriority { priority: ConversationPriority },
    /// Set or clear the conversation assignee.
    SetAssignee {
        #[serde(default)]
        #[serde(rename = "assigneeId")]
        assignee_id: Option<String>,
    },
    /// Best-effort sleep (NOT durable). The request blocks server-side
    /// for `seconds` before moving on. Bounded by the executor.
    Wait { seconds: u32 },
    /// Move the conversation to `snoozed` with the given RFC3339
    /// wake-up time.
    Snooze {
        #[serde(rename = "untilIso")]
        until_iso: String,
    },
    /// Short-hand for `SetStatus { Resolved }`. Stamps `resolvedAt`.
    Resolve,
}

// ---------------------------------------------------------------------------
// `POST /` — create_macro
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/macros`. `steps` is the ordered list the
/// executor walks. `shortcut` is an optional keyboard / slash command
/// hint surfaced in the agent UI.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateMacroBody {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub shortcut: Option<String>,
    #[serde(default)]
    pub steps: Vec<MacroStep>,
}

// ---------------------------------------------------------------------------
// `GET /` — list_macros
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/macros`. All filters AND-combined;
/// pagination is cursor-based on `_id`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListMacrosQuery {
    /// Case-insensitive substring match against `name` and `shortcut`.
    #[serde(default)]
    pub q: Option<String>,
    /// Page size — defaults to [`DEFAULT_LIMIT`], capped at [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<i64>,
    /// Cursor = hex `_id` of the last document on the previous page.
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response body for `GET /v1/sabchat/macros`. `nextCursor` is omitted
/// once the listing is exhausted.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListMacrosResponse {
    #[schema(value_type = Vec<Object>)]
    pub macros: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

// ---------------------------------------------------------------------------
// `PATCH /{id}` — update_macro
// ---------------------------------------------------------------------------

/// Body for `PATCH /v1/sabchat/macros/{id}`. Every field is optional —
/// only the fields explicitly provided are `$set`. Passing
/// `steps: Some(vec![])` is a deliberate "clear the steps" request.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMacroBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub shortcut: Option<String>,
    #[serde(default)]
    pub steps: Option<Vec<MacroStep>>,
}

// ---------------------------------------------------------------------------
// `POST /{id}/run` — run_macro
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/macros/{id}/run`. The executor walks the
/// macro's steps in order against `conversationId`, substituting any
/// `{{path.to.var}}` placeholders in send-message blocks against
/// `vars + conversation.customAttrs` (request `vars` take precedence).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RunMacroBody {
    /// Target conversation (hex `ObjectId`). Must belong to the
    /// caller's tenant.
    pub conversation_id: String,
    /// Optional per-call variables — merged on top of the
    /// conversation's `customAttrs` at interpolation time.
    #[serde(default)]
    pub vars: Option<Value>,
}

/// Response body for `POST /v1/sabchat/macros/{id}/run`. `stepsRan` is
/// the count of steps that completed before the executor either
/// finished the program or hit a fatal error. `errors` is the
/// best-effort list of per-step messages — the executor continues
/// through non-fatal failures so a partial run is visible to the caller.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RunMacroResponse {
    pub steps_ran: u32,
    pub errors: Vec<RunStepError>,
}

/// Per-step error reported by the [`RunMacroResponse`] payload.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RunStepError {
    /// Zero-indexed step number in the macro's `steps` array.
    pub step: u32,
    /// `send_message`, `set_status`, … — the `kind` discriminant.
    pub kind: String,
    /// Human-readable failure reason.
    pub message: String,
}

// ---------------------------------------------------------------------------
// Generic envelopes
// ---------------------------------------------------------------------------

/// Envelope returned by every handler that hands back a single macro
/// document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MacroResponse {
    #[schema(value_type = Object)]
    pub r#macro: Value,
}

/// `{ success: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
