//! Wire-format DTOs for the SabChat voice / video calling endpoints.
//!
//! Every body and query uses `#[serde(rename_all = "camelCase")]` to
//! match the JSON the Next.js side sends. Stored documents come back
//! as `serde_json::Value` (via `sabnode_db::document_to_clean_json`)
//! so the router stays out of the way when callers evolve the record
//! shape — the same approach `sabchat-audit` and `wachat-contacts`
//! already take.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Defaults / limits
// ---------------------------------------------------------------------------

/// Maximum page size accepted on the `GET /calls` list endpoint. Calls
/// are append-only and can grow without bound; capping keeps the
/// driver round-trip bounded even when a caller passes a giant
/// `limit`.
pub const MAX_LIMIT: i64 = 200;

/// Default page size when `limit` is omitted from the query string.
pub const DEFAULT_LIMIT: i64 = 50;

fn default_limit() -> i64 {
    DEFAULT_LIMIT
}

// ---------------------------------------------------------------------------
// Kind / initiator / status enums shared with `sabchat_calls`
// ---------------------------------------------------------------------------

/// Voice or video. Stored on the call row and used to format the
/// system-message that lands in the conversation when the call ends.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CallKind {
    Voice,
    Video,
}

impl CallKind {
    /// Lower-case, snake-case wire form. Used directly inside Mongo
    /// `doc!` literals so the BSON value stays in lockstep with the
    /// JSON enum discriminant.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Voice => "voice",
            Self::Video => "video",
        }
    }

    /// Human-readable label for the system message posted when a call
    /// ends (e.g. `"voice call ended (42s)"`).
    pub fn label(self) -> &'static str {
        match self {
            Self::Voice => "voice",
            Self::Video => "video",
        }
    }
}

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/voice/calls` — start
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/voice/calls` — create a new ringing
/// call against an existing conversation. The conversation must
/// belong to the caller's tenant (enforced server-side); the call is
/// always initiated by the **agent** side because this endpoint
/// requires `AuthUser`. Visitor-initiated calls come in over the
/// widget channel and use a different surface.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StartCallBody {
    /// Hex `ObjectId` of the parent conversation.
    pub conversation_id: String,
    /// Voice or video.
    pub kind: CallKind,
}

/// Response envelope for `POST /v1/sabchat/voice/calls`. Returns the
/// new call's id, the freshly-generated room id, and the provider
/// access token (stub `"stub"` today).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StartCallResponse {
    pub call_id: String,
    pub room_id: String,
    pub token: String,
}

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/voice/calls/{id}/answer`
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/voice/calls/{id}/answer`. Empty today —
/// the endpoint exists so the client can flip the call to
/// `ongoing` + stamp `startedAt` server-side without juggling the
/// timestamp from the browser.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AnswerCallBody {}

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/voice/calls/{id}/end`
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/voice/calls/{id}/end`. The optional
/// `recordingUrl` is the post-roll SabFiles URL the provider hands
/// back when recording is enabled; persisted verbatim on the call
/// row. The `durationS` field is *derived* server-side from
/// `endedAt - startedAt` (when both exist) so the client cannot lie
/// about call length.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EndCallBody {
    /// Optional recording URL (SabFiles) the provider hands back.
    #[serde(default)]
    pub recording_url: Option<String>,
}

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/voice/calls/{id}/fail`
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/voice/calls/{id}/fail`. The `reason`
/// is persisted as `failureReason` on the call row so dashboards can
/// roll up failure causes (no-answer, network-error, declined, ...).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FailCallBody {
    pub reason: String,
}

// ---------------------------------------------------------------------------
// `GET /v1/sabchat/voice/calls` — list
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/voice/calls`. Every field is
/// optional — the only mandatory scope is the tenant id, derived from
/// the caller's JWT.
///
/// `cursor` is a hex `ObjectId` string; when supplied the result set
/// is constrained to calls with `_id < cursor`, which combined with
/// the `_id DESC` sort gives stable cursor-style pagination without a
/// count query.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListCallsQuery {
    /// Hex `ObjectId` — restrict to a single conversation.
    #[serde(default)]
    pub conversation_id: Option<String>,
    /// `snake_case` status discriminant
    /// (`ringing` / `ongoing` / `ended` / `failed` / `missed`).
    /// Passed through verbatim — invalid values yield an empty result
    /// set rather than a 400 (matches the audit list contract).
    #[serde(default)]
    pub status: Option<String>,
    /// Page size — clamped to `[1, MAX_LIMIT]` server-side.
    #[serde(default = "default_limit")]
    pub limit: i64,
    /// Hex `ObjectId` cursor — calls with `_id < cursor` only.
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response body for `GET /v1/sabchat/voice/calls`. Newest first by
/// `_id`. `nextCursor` is the `_id` of the **last** document in
/// `calls` — pass it back as `cursor` to fetch the next page; `None`
/// means the caller has reached the end.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListCallsResponse {
    #[schema(value_type = Vec<Object>)]
    pub calls: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

// ---------------------------------------------------------------------------
// `GET /v1/sabchat/voice/token` — re-issue room token
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/voice/token`. Providers rotate
/// tokens periodically (LiveKit's default TTL is 6 hours, Daily.co's
/// is 1h); the client calls back here to refresh.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TokenQuery {
    /// Hex `ObjectId` of the call whose room token should be
    /// re-issued.
    pub call_id: String,
}

/// Response envelope for `GET /v1/sabchat/voice/token`. Stub returns
/// the literal string `"stub"`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TokenResponse {
    pub token: String,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by the lifecycle-transition
/// endpoints (`answer` / `end` / `fail`). Matches the
/// `wachat-contacts` `SuccessResponse` convention.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
