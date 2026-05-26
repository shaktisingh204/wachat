//! Wire-format DTOs for the SabChat co-browse HTTP surface.
//!
//! Every body / query / response uses `#[serde(rename_all = "camelCase")]`
//! so the JSON shape matches what the agent UI and the public visitor
//! widget send / expect. Stored Mongo documents are returned as
//! `serde_json::Value` (via [`serde_json::Value`]) so the wire stays
//! decoupled from the BSON shapes persisted in
//! `sabchat_cobrowse_sessions`.
//!
//! Two trust domains share this file:
//!
//! - **Agent side** — used by [`crate::handlers`]; the caller is
//!   authenticated via [`sabnode_auth::AuthUser`]. Bodies:
//!   [`RequestCobrowseResponse`], [`EndCobrowseResponse`],
//!   [`ListCobrowseQuery`], [`ListCobrowseResponse`].
//! - **Public side** — used by [`crate::public_handlers`]; the caller is
//!   the JS widget, authenticated only by the opaque `visitorToken` in
//!   the path. Bodies: [`ConsentBody`], [`PublicCobrowseStatus`].

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ===========================================================================
// Agent side — request_session
// ===========================================================================

/// Response from `POST /v1/sabchat/cobrowse/request/{conversationId}`.
///
/// The handler mints a fresh session row in `pending` state and returns
/// the opaque `visitorToken` that the agent UI hands to the visitor
/// widget (over an out-of-band channel — typically by pushing the token
/// down the existing visitor chat session). The visitor then calls
/// [`crate::public_handlers::grant_consent`] with that token to flip the
/// session to `active`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RequestCobrowseResponse {
    /// Hex-encoded `ObjectId` of the new session row.
    pub session_id: String,
    /// 64-character lowercase hex token. Treated as a bearer secret —
    /// anyone who knows it can call the public endpoints for this
    /// session, so the agent UI only ever transmits it over an
    /// already-authenticated channel.
    pub visitor_token: String,
    /// Lifecycle state of the freshly-minted session — always `pending`
    /// at this point.
    pub status: String,
}

// ===========================================================================
// Agent side — end_session
// ===========================================================================

/// Response from `POST /v1/sabchat/cobrowse/{sessionId}/end`.
///
/// Carries no payload beyond the trivial `ok: true` flag — the handler
/// also appends a `System` content block to the linked conversation and
/// emits a `message_sent` audit event so the activity feed reflects the
/// teardown.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EndCobrowseResponse {
    /// Always `true` on a 2xx response. Present so the wire shape is
    /// stable for clients that expect a JSON object rather than a bare
    /// `204`.
    pub ok: bool,
}

impl EndCobrowseResponse {
    /// Construct the canonical `{ ok: true }` body.
    pub fn ok() -> Self {
        Self { ok: true }
    }
}

// ===========================================================================
// Public side — consent
// ===========================================================================

/// Body for `POST /v1/sabchat/cobrowse-public/{visitorToken}/consent`.
///
/// A single boolean — `true` grants the agent permission to drive the
/// shared session (state flips to `active`); `false` declines (state
/// flips to `ended`). Either way the call is idempotent at the
/// per-session level: replaying the same body on an already-ended
/// session has no further effect.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConsentBody {
    /// `true` to grant, `false` to decline.
    pub granted: bool,
}

// ===========================================================================
// Public side — session_status
// ===========================================================================

/// Response from `GET /v1/sabchat/cobrowse-public/{visitorToken}`.
///
/// Polled by the public widget so it can update its UI as the agent
/// ends the session or the visitor's earlier consent is reflected.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicCobrowseStatus {
    /// Lifecycle state — one of `pending`, `active`, `ended`.
    pub status: String,
    /// `true` once the visitor has clicked "Allow" (and the agent
    /// hasn't subsequently torn the session down).
    pub consent_granted: bool,
    /// Hint to the widget renderer — when `true`, the page-side
    /// co-browse driver should redact `<input type="password">` values
    /// before mirroring DOM mutations to the agent. Always `true`
    /// today; stored on the row so per-tenant policy can override
    /// later without a client change.
    pub mask_password_fields: bool,
}

// ===========================================================================
// Agent side — list_sessions
// ===========================================================================

/// Query string for `GET /v1/sabchat/cobrowse/`.
///
/// `conversationId` is optional — when supplied, only sessions linked
/// to that conversation are returned. When omitted, the handler still
/// scopes by the caller's tenant, but returns the full set across every
/// conversation the tenant owns (useful for an admin "all active
/// co-browse sessions" view).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListCobrowseQuery {
    /// Optional hex `ObjectId` filter on `conversationId`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<String>,
}

/// Response from `GET /v1/sabchat/cobrowse/`. Documents are streamed as
/// opaque `serde_json::Value` blobs so the wire format stays decoupled
/// from the BSON shape persisted in `sabchat_cobrowse_sessions`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListCobrowseResponse {
    /// Newest-first list of session rows (rendered via
    /// `document_to_clean_json` — hex ObjectIds, ISO 8601 timestamps).
    pub items: Vec<Value>,
}
