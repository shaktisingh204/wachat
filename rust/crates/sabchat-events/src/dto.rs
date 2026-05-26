//! Wire-format DTOs for the SabChat events endpoints.
//!
//! Mirrors the read + replay HTTP surface this crate exposes:
//!
//! | Route                  | Query / response                                  |
//! |------------------------|---------------------------------------------------|
//! | `GET  /`               | [`ListEventsQuery`] → [`ListEventsResponse`]      |
//! | `GET  /{id}`           | path param → `serde_json::Value` (one envelope)   |
//! | `POST /replay/{id}`    | path param → [`ReplayResponse`]                   |
//!
//! Stored documents are returned as `serde_json::Value` — the same
//! approach the wachat-contacts and sabchat-audit list endpoints use —
//! so the router stays out of the way when downstream callers evolve
//! the document shape. The shape on the wire is the cleaned,
//! hex-string-ObjectId, ISO-8601 form produced by
//! [`sabnode_db::document_to_clean_json`].

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Defaults / limits
// ---------------------------------------------------------------------------

/// Maximum page size accepted on the list endpoint. The audit log is
/// append-only and unbounded; capping at 500 keeps Mongo round trips
/// bounded even when callers ask for huge pages.
pub const MAX_LIMIT: i64 = 500;

/// Default page size when `limit` is omitted from the query string.
pub const DEFAULT_LIMIT: i64 = 50;

fn default_limit() -> i64 {
    DEFAULT_LIMIT
}

// ---------------------------------------------------------------------------
// `GET /v1/sabchat/events` — list_events
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/events`. Every field is optional —
/// the only mandatory scope is the tenant id, which is derived from
/// the caller's JWT, not the query string.
///
/// `since` and `until` are RFC 3339 strings (e.g.
/// `2026-05-27T12:00:00Z`) and filter on the document's `createdAt`
/// field — `since` is inclusive, `until` is exclusive, matching the
/// "half-open interval" convention the rest of the SabChat surface uses.
///
/// `cursor` is a hex `ObjectId` string; when supplied the result set is
/// constrained to events with `_id < cursor`, which combined with the
/// `_id DESC` sort gives stable cursor-style pagination without a
/// count query.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListEventsQuery {
    /// One of the `KIND_*` constants in [`crate`] (e.g.
    /// `conversation.assigned`). Passed through verbatim — unknown
    /// values yield an empty result set rather than a 400, mirroring
    /// the loose filter contract sabchat-audit uses.
    #[serde(default)]
    pub kind: Option<String>,

    /// RFC 3339 timestamp — inclusive lower bound on `createdAt`.
    #[serde(default)]
    pub since: Option<String>,

    /// RFC 3339 timestamp — exclusive upper bound on `createdAt`.
    #[serde(default)]
    pub until: Option<String>,

    /// Page size — clamped to `[1, MAX_LIMIT]` server-side.
    #[serde(default = "default_limit")]
    pub limit: i64,

    /// Hex `ObjectId` cursor — events with `_id < cursor` only.
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response body for `GET /v1/sabchat/events`. Events are sorted
/// **newest first** by `_id` (which on Mongo's ObjectId encoding is
/// monotonic with insertion time, so this is equivalent to
/// `createdAt DESC` without needing a secondary index).
///
/// `nextCursor` is the `_id` of the **last** document in `events` —
/// pass it back as `cursor` to fetch the next page. `None` means the
/// caller has reached the end.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListEventsResponse {
    #[schema(value_type = Vec<Object>)]
    pub events: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/events/replay/{id}` — replay_event
// ---------------------------------------------------------------------------

/// Response body for `POST /v1/sabchat/events/replay/{id}`. Mirrors
/// the contract documented in the crate spec: a flat `{ replayed: true }`
/// envelope on success.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReplayResponse {
    pub replayed: bool,
}

impl ReplayResponse {
    pub fn ok() -> Self {
        Self { replayed: true }
    }
}
