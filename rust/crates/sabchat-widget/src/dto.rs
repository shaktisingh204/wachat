//! Wire-format DTOs for the public SabChat widget endpoints.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to match
//! the JSON the third-party widget sends. Stored documents are returned
//! as `serde_json::Value` so the wire stays decoupled from the BSON
//! shapes in `sabchat-types`.

use sabchat_types::ContentBlock;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Defaults / limits
// ---------------------------------------------------------------------------

/// Default and maximum page size for history reads.
pub const HISTORY_DEFAULT_LIMIT: i64 = 50;
pub const HISTORY_MAX_LIMIT: i64 = 100;

/// Session TTL, in days. Refreshed on every [`PostMessageBody`].
pub const SESSION_TTL_DAYS: i64 = 7;

fn default_limit() -> i64 {
    HISTORY_DEFAULT_LIMIT
}

// ---------------------------------------------------------------------------
// GET /config — public_config
// ---------------------------------------------------------------------------

/// Query string for `GET /config`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicConfigQuery {
    pub inbox_id: String,
}

/// Public config payload returned to the widget bootstrap script. All
/// fields except `enabled` are pulled from the website channel's
/// `channel_config.settings` blob, which is the canonical place the
/// inbox UI writes widget configuration.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicConfigResponse {
    /// Whether the inbox is currently serving traffic.
    pub enabled: bool,
    /// Hex / CSS colour string. Optional — widget falls back to its
    /// own brand default when absent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub widget_color: Option<String>,
    /// Team display name shown in the widget header.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_name: Option<String>,
    /// Optional team avatar URL.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
    /// Welcome message shown above the composer when the conversation
    /// is empty.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub welcome_message: Option<String>,
    /// Away message shown when the inbox is outside business hours.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub away_message: Option<String>,
    /// Business-hours block, opaque to the widget bootstrap — the
    /// widget renderer interprets it.
    #[serde(default, skip_serializing_if = "Value::is_null")]
    pub business_hours: Value,
    /// Full `channel_config.settings` blob (camelCase JSON) so the widget
    /// can read the rich Widget-Studio fields (title, colours, radii,
    /// position, replyTime, proactiveRules, …) without enumerating each
    /// one here.
    #[serde(default, skip_serializing_if = "Value::is_null")]
    pub settings: Value,
}

impl PublicConfigResponse {
    /// Cheap helper used by the handler when the inbox is disabled —
    /// returns `{ enabled: false }` with every other field cleared.
    pub fn disabled() -> Self {
        Self {
            enabled: false,
            widget_color: None,
            team_name: None,
            avatar_url: None,
            welcome_message: None,
            away_message: None,
            business_hours: Value::Null,
            settings: Value::Null,
        }
    }
}

// ---------------------------------------------------------------------------
// POST /session — start_session
// ---------------------------------------------------------------------------

/// Body for `POST /session`. If `visitorToken` is supplied and still
/// valid, the same session is returned. Otherwise we resolve-or-create
/// a contact (preferring `externalUserId`, falling back to `email`),
/// open a fresh conversation, and mint a new token.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionBody {
    pub inbox_id: String,
    /// If present + valid + unexpired, the existing session is
    /// resumed and no new contact / conversation is created.
    #[serde(default)]
    pub visitor_token: Option<String>,
    /// External (host-app) user id. When present the host must also
    /// pass `identityHmac` if the inbox has an `identity_secret`.
    #[serde(default)]
    pub external_user_id: Option<String>,
    /// Optional pre-filled email (used for contact merge).
    #[serde(default)]
    pub email: Option<String>,
    /// Optional pre-filled display name.
    #[serde(default)]
    pub name: Option<String>,
    /// `hex(hmac_sha256(identity_secret, external_user_id))`. Required
    /// when `external_user_id` is supplied AND the inbox has an
    /// `identity_secret` configured.
    #[serde(default)]
    pub identity_hmac: Option<String>,
}

/// Response body for `POST /session`. The widget stores `visitorToken`
/// in `localStorage` and sends it on every subsequent call.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionResponse {
    pub session_id: String,
    pub visitor_token: String,
    pub conversation_id: String,
    pub contact_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub welcome_message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub widget_color: Option<String>,
}

// ---------------------------------------------------------------------------
// POST /identify — attach email/name to the current contact
// ---------------------------------------------------------------------------

/// Body for `POST /identify`. Attaches an email / display name to the
/// CURRENT session's contact (resolved by `visitorToken`) without forking
/// a new conversation — calling `/session` again would create a new thread.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IdentifyBody {
    pub visitor_token: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
}

// ---------------------------------------------------------------------------
// GET /stream — live SSE feed for the visitor's conversation
// ---------------------------------------------------------------------------

/// Query string for `GET /stream` (Server-Sent Events).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StreamQuery {
    pub visitor_token: String,
}

// ---------------------------------------------------------------------------
// POST /messages — post_message
// ---------------------------------------------------------------------------

/// Body for `POST /messages`. The widget sends one `ContentBlock` at a
/// time — same shape the agent inbox uses, so the message renders
/// identically on both sides.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PostMessageBody {
    pub visitor_token: String,
    #[schema(value_type = Object)]
    pub content: ContentBlock,
}

/// Response body for `POST /messages`. Returns the new message id and
/// the canonical `created_at` so the widget can deduplicate optimistic
/// renders.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PostMessageResponse {
    pub message_id: String,
    /// ISO-8601 UTC timestamp.
    pub created_at: String,
}

// ---------------------------------------------------------------------------
// GET /history — fetch_history
// ---------------------------------------------------------------------------

/// Query string for `GET /history`. Newest-first cursor pagination
/// keyed by `_id`. `limit` is hard-capped server-side at 100.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FetchHistoryQuery {
    pub visitor_token: String,
    /// Return messages with `_id < beforeId`. Absent → newest page.
    #[serde(default)]
    pub before_id: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

/// Response body for `GET /history`. Documents are pre-projected to
/// JSON via `sabnode_db::document_to_clean_json` so `ObjectId`s become
/// hex strings and `BSON DateTime`s become ISO-8601.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FetchHistoryResponse {
    #[schema(value_type = Vec<Object>)]
    pub messages: Vec<Value>,
    /// Convenience — true when fewer than `limit` rows were returned.
    pub has_more: bool,
}

// ---------------------------------------------------------------------------
// POST /end — end_session
// ---------------------------------------------------------------------------

/// Body for `POST /end`. Marks the conversation as resolved if it is
/// still in `open` or `pending`. The session row is left in place so
/// the visitor's history is still readable from the widget until the
/// token's natural 7-day expiry.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EndSessionBody {
    pub visitor_token: String,
}

// ---------------------------------------------------------------------------
// Generic envelopes
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by terminal POST endpoints.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
