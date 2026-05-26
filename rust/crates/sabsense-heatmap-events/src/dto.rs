//! Ingestion + query DTOs.

use serde::{Deserialize, Serialize};

use crate::types::HeatmapEventType;

/// One row in a batched ingest body. The session+viewport context is
/// carried per-row so the snippet can flush events out of order if
/// needed.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestEvent {
    pub url: String,
    pub event_type: HeatmapEventType,
    pub x: f32,
    pub y: f32,
    pub viewport_w: u32,
    pub viewport_h: u32,
    pub session_id: String,
    #[serde(default)]
    pub variant: Option<String>,
    /// Epoch millis from the client. Re-stamped server-side on insert.
    #[serde(default)]
    pub ts: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestBatch {
    pub site_id: String,
    pub events: Vec<IngestEvent>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestResponse {
    pub accepted: u32,
    pub rejected: u32,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventsQuery {
    pub site_id: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub event_type: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub from_ms: Option<i64>,
    #[serde(default)]
    pub to_ms: Option<i64>,
}
