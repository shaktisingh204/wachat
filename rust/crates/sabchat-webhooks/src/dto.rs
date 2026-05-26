//! Wire-format DTOs for the SabChat webhook endpoints.
//!
//! All bodies / queries use `#[serde(rename_all = "camelCase")]` to
//! match the JSON the Next.js side already speaks. Stored documents are
//! returned as `serde_json::Value` so the router stays out of the way
//! when callers evolve the document shape — the same approach
//! `wachat-contacts` and `sabchat-audit` take with `document_to_clean_json`.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Defaults / clamps
// ---------------------------------------------------------------------------

/// Default page size for the delivery + DLQ listings.
pub const DEFAULT_LIMIT: i64 = 50;
/// Hard cap so a tenant cannot ask for an unbounded page.
pub const MAX_LIMIT: i64 = 200;

fn default_limit() -> i64 {
    DEFAULT_LIMIT
}

// ---------------------------------------------------------------------------
// `POST /endpoints` — register a new endpoint
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/webhooks/endpoints`. The `secret` is
/// optional — if omitted, the handler generates a random hex string and
/// echoes it back exactly once on the response. After that the secret
/// is treated as opaque storage for the outbound worker to read at
/// sign-time.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateEndpointBody {
    /// Absolute http(s) URL the worker will POST to. Validated with the
    /// `url` crate; non-http(s) schemes are rejected.
    pub url: String,
    /// Optional shared secret. When `None`, the handler generates a
    /// fresh 32-byte random hex string.
    #[serde(default)]
    pub secret: Option<String>,
    /// Event kinds this endpoint subscribes to. Free-form strings —
    /// matching happens on equality, so `["message.created",
    /// "conversation.updated"]` is the canonical shape.
    #[serde(default)]
    pub events: Vec<String>,
    /// Defaults to `true` — caller can set `false` to register a paused
    /// endpoint.
    #[serde(default = "default_true")]
    pub active: bool,
}

fn default_true() -> bool {
    true
}

/// Body for `PATCH /v1/sabchat/webhooks/endpoints/{id}`. Every field is
/// optional — only the keys present in the request are `$set`. To
/// rotate the secret, send the new value; to clear it, send an empty
/// string and the handler will regenerate one.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEndpointBody {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub secret: Option<String>,
    #[serde(default)]
    pub events: Option<Vec<String>>,
    #[serde(default)]
    pub active: Option<bool>,
}

// ---------------------------------------------------------------------------
// Endpoint envelopes
// ---------------------------------------------------------------------------

/// Response envelope for a freshly created endpoint. The handler echoes
/// the resolved `secret` here so the caller can copy it once — there is
/// no separate `GET /endpoints/{id}/secret` endpoint, so the create
/// response is the only time the secret is surfaced in cleartext.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateEndpointResponse {
    pub id: String,
    pub url: String,
    pub secret: String,
    pub events: Vec<String>,
    pub active: bool,
}

/// `{ endpoints: [...] }` for the list endpoint. Each entry is the raw
/// stored document with ObjectIds → hex and dates → ISO 8601.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListEndpointsResponse {
    #[schema(value_type = Vec<Object>)]
    pub endpoints: Vec<Value>,
}

// ---------------------------------------------------------------------------
// `GET /deliveries` — list deliveries
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/webhooks/deliveries`. Cursor is
/// the hex `_id` of the last row from the previous page (newest first).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListDeliveriesQuery {
    /// Optional endpoint scope — only return deliveries targeting this
    /// endpoint id.
    #[serde(default)]
    pub endpoint_id: Option<String>,
    /// Optional status filter — `pending` / `delivered` / `failed`.
    #[serde(default)]
    pub status: Option<String>,
    /// Page size; clamped server-side to `MAX_LIMIT`.
    #[serde(default = "default_limit")]
    pub limit: i64,
    /// Hex `_id` of the last row from the previous page.
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response body for the delivery / DLQ listings.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListDeliveriesResponse {
    #[schema(value_type = Vec<Object>)]
    pub deliveries: Vec<Value>,
    /// `_id` of the last document, suitable to pass back as `cursor` on
    /// the next call. `None` when we returned fewer than `limit` rows.
    pub next_cursor: Option<String>,
}

// ---------------------------------------------------------------------------
// `GET /dlq` — list DLQ rows
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/webhooks/dlq`. Same pagination
/// shape as the delivery listing, no extra filters today.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListDlqQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub cursor: Option<String>,
}

// ---------------------------------------------------------------------------
// Test send + retry envelopes
// ---------------------------------------------------------------------------

/// Response from `POST /v1/sabchat/webhooks/endpoints/{id}/test`. The
/// crate does not actually fire an HTTP call — that is the worker's
/// job. We record one `pending` delivery row and echo its id back so
/// the caller can poll the delivery log.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TestEndpointResponse {
    pub delivery_id: String,
    pub event: String,
}

/// Response from `POST /v1/sabchat/webhooks/deliveries/{id}/retry`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RetryDeliveryResponse {
    pub id: String,
    pub status: String,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by PATCH / DELETE endpoints —
/// matches the `wachat-contacts` convention.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
