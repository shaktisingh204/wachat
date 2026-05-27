use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub trace_id: Option<String>,
    #[serde(default)]
    pub service: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestSpanInput {
    pub trace_id: String,
    #[serde(default)]
    pub parent_span_id: Option<String>,
    pub span_id: String,
    pub service: String,
    pub operation: String,
    /// Epoch millis.
    pub started_at_ms: i64,
    pub duration_ms: i64,
    #[serde(default)]
    pub tags_json: Option<JsonValue>,
    #[serde(default)]
    pub errored: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestSpanResponse {
    pub id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<crate::types::SabmonitorTraceSpan>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
