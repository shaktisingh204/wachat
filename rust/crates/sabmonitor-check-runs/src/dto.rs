use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub check_id: Option<String>,
    /// Optional `up|down|warning` filter.
    #[serde(default)]
    pub status: Option<String>,
    /// Optional probe region filter.
    #[serde(default)]
    pub region: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportRunInput {
    pub check_id: String,
    pub probe_region: String,
    pub status: String,
    pub response_ms: i32,
    #[serde(default)]
    pub http_status_code: Option<i32>,
    #[serde(default)]
    pub ssl_days_to_expiry: Option<i32>,
    #[serde(default)]
    pub error_message: Option<String>,
    #[serde(default)]
    pub trace_json: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportRunResponse {
    pub id: String,
    pub entity: crate::types::SabmonitorCheckRun,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<crate::types::SabmonitorCheckRun>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
