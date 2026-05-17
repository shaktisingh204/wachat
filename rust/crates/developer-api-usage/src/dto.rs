use serde::{Deserialize, Serialize};

/* ── Query knobs ───────────────────────────────────────────────────────── */

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WindowQuery {
    /// Inclusive ISO-8601 lower bound. Defaults to now-24h.
    pub from: Option<String>,
    /// Exclusive ISO-8601 upper bound. Defaults to now.
    pub to: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TopQuery {
    pub from: Option<String>,
    pub to: Option<String>,
    /// Max rows. Capped at 100 by the store.
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LogsQuery {
    pub from: Option<String>,
    pub to: Option<String>,
    pub key_id: Option<String>,
    pub path: Option<String>,
    pub min_status: Option<i32>,
    /// Opaque pagination cursor — hex `_id` of the last row returned.
    pub cursor: Option<String>,
    pub limit: Option<i64>,
}

/* ── Responses ─────────────────────────────────────────────────────────── */

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub from: String,
    pub to: String,
    pub total_requests: u64,
    pub error_requests: u64,
    pub avg_latency_ms: f64,
    pub p95_latency_ms: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopRow {
    pub path: String,
    pub method: String,
    pub count: u64,
    pub error_count: u64,
    pub avg_latency_ms: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopList {
    pub data: Vec<TopRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ByKeyRow {
    pub key_id: String,
    pub kind: String,
    pub env: String,
    pub count: u64,
    pub error_count: u64,
    pub last_used_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ByKeyList {
    pub data: Vec<ByKeyRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogRow {
    #[serde(rename = "_id")]
    pub id: String,
    pub method: String,
    pub path: String,
    pub status: i32,
    pub latency_ms: i64,
    pub key_id: String,
    pub kind: String,
    pub env: String,
    pub request_id: Option<String>,
    pub error_type: Option<String>,
    pub user_agent: Option<String>,
    pub ts: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogPage {
    pub data: Vec<LogRow>,
    pub next_cursor: Option<String>,
}
