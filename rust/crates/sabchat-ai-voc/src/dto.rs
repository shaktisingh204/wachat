//! Wire-format DTOs for the SabChat AI voice-of-customer endpoints.
//!
//! All payloads use `#[serde(rename_all = "camelCase")]` to match the
//! JSON shape the Next.js shim sends. Stored documents are returned as
//! `serde_json::Value` (via `document_to_clean_json`) so the router
//! stays out of the way when callers evolve the document shape — the
//! same approach used by the sibling SabChat handler crates.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Defaults + caps
// ---------------------------------------------------------------------------

/// How far back to look when `body.since` is omitted on `POST /run`.
/// 7 days mirrors the slice spec.
pub const DEFAULT_LOOKBACK_DAYS: i64 = 7;

/// Default `?limit=` for `GET /runs`.
pub const DEFAULT_RUN_LIMIT: i64 = 20;
/// Cap on `?limit=` for `GET /runs` to keep responses bounded.
pub const MAX_RUN_LIMIT: i64 = 100;

/// Default `?limit=` for `GET /topics`.
pub const DEFAULT_TOPIC_LIMIT: i64 = 50;
/// Cap on `?limit=` for `GET /topics`.
pub const MAX_TOPIC_LIMIT: i64 = 200;

/// Default `?limit=` for `GET /topics/{id}/messages`.
pub const DEFAULT_TOPIC_MESSAGE_LIMIT: i64 = 25;
/// Cap on `?limit=` for `GET /topics/{id}/messages`.
pub const MAX_TOPIC_MESSAGE_LIMIT: i64 = 100;

// ---------------------------------------------------------------------------
// POST /v1/sabchat/ai/voc/run
// ---------------------------------------------------------------------------

/// Body for `POST /run` — kick off a clustering run. `since` is
/// optional; when omitted we fall back to [`DEFAULT_LOOKBACK_DAYS`] ago.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RunVocBody {
    /// ISO-8601 lower bound on `createdAt`. Defaults to now minus
    /// [`DEFAULT_LOOKBACK_DAYS`] when absent.
    #[serde(default)]
    pub since: Option<DateTime<Utc>>,
}

/// Response for `POST /run`. `runId` is the hex `ObjectId` of the
/// newly-created `sabchat_voc_runs` document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RunVocResponse {
    pub run_id: String,
    pub topic_count: u32,
    pub message_count: u32,
}

// ---------------------------------------------------------------------------
// GET /v1/sabchat/ai/voc/runs
// ---------------------------------------------------------------------------

/// Query string for `GET /runs`. `limit` is clamped to
/// [`MAX_RUN_LIMIT`].
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListRunsQuery {
    #[serde(default)]
    pub limit: Option<i64>,
}

/// Response for `GET /runs` — newest-first list of run documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListRunsResponse {
    #[schema(value_type = Vec<Object>)]
    pub runs: Vec<Value>,
}

// ---------------------------------------------------------------------------
// GET /v1/sabchat/ai/voc/runs/{id}
// ---------------------------------------------------------------------------

/// Response for `GET /runs/{id}` — one run document, rendered as a
/// free-form JSON object (`document_to_clean_json` reshape).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetRunResponse {
    #[schema(value_type = Object)]
    pub run: Value,
}

// ---------------------------------------------------------------------------
// GET /v1/sabchat/ai/voc/topics
// ---------------------------------------------------------------------------

/// Query string for `GET /topics`. `limit` is clamped to
/// [`MAX_TOPIC_LIMIT`].
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTopicsQuery {
    #[serde(default)]
    pub limit: Option<i64>,
}

/// Response for `GET /topics` — topics for the caller's tenant sorted
/// by `messageCount DESC`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTopicsResponse {
    #[schema(value_type = Vec<Object>)]
    pub topics: Vec<Value>,
}

// ---------------------------------------------------------------------------
// GET /v1/sabchat/ai/voc/topics/{id}/messages
// ---------------------------------------------------------------------------

/// Query string for `GET /topics/{id}/messages`. `limit` is clamped to
/// [`MAX_TOPIC_MESSAGE_LIMIT`].
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTopicMessagesQuery {
    #[serde(default)]
    pub limit: Option<i64>,
}

/// Response for `GET /topics/{id}/messages` — newest-first list of
/// visitor messages whose text matched the topic's keyword(s).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTopicMessagesResponse {
    #[schema(value_type = Vec<Object>)]
    pub messages: Vec<Value>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Clamp a caller-supplied limit into `[1, max]`, defaulting to
/// `default` when absent or non-positive. Shared by every list
/// endpoint so the clamp semantics stay consistent.
pub fn clamp_limit(raw: Option<i64>, default: i64, max: i64) -> i64 {
    let v = raw.unwrap_or(default);
    if v <= 0 { default } else { v.min(max) }
}
