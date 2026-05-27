use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// Only errored traces.
    #[serde(default)]
    pub errored_only: Option<bool>,
    /// Only traces slower than `slowMs`.
    #[serde(default)]
    pub slow_ms: Option<i64>,
    #[serde(default)]
    pub service: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<crate::types::SabmonitorTrace>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
