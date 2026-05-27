//! Request DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `active` | `paused` | `all`. Defaults `all`.
    #[serde(default)]
    pub status: Option<String>,
    /// Filter by kind (e.g. `http`).
    #[serde(default)]
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCheckInput {
    pub name: String,
    pub kind: String,
    pub interval_secs: i32,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub host: Option<String>,
    #[serde(default)]
    pub port: Option<i32>,
    #[serde(default)]
    pub regions: Vec<String>,
    #[serde(default)]
    pub headers_json: Option<String>,
    #[serde(default)]
    pub body_json: Option<String>,
    #[serde(default)]
    pub expected_status: Option<i32>,
    #[serde(default)]
    pub expected_body_contains: Option<String>,
    #[serde(default)]
    pub expected_body_regex: Option<String>,
    #[serde(default)]
    pub ssl_expiry_warn_days: Option<i32>,
    #[serde(default)]
    pub synthetic_script_id: Option<String>,
    #[serde(default)]
    pub api_transaction_id: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub interval_secs: Option<i32>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub host: Option<String>,
    #[serde(default)]
    pub port: Option<i32>,
    #[serde(default)]
    pub regions: Option<Vec<String>>,
    #[serde(default)]
    pub headers_json: Option<String>,
    #[serde(default)]
    pub body_json: Option<String>,
    #[serde(default)]
    pub expected_status: Option<i32>,
    #[serde(default)]
    pub expected_body_contains: Option<String>,
    #[serde(default)]
    pub expected_body_regex: Option<String>,
    #[serde(default)]
    pub ssl_expiry_warn_days: Option<i32>,
    #[serde(default)]
    pub synthetic_script_id: Option<String>,
    #[serde(default)]
    pub api_transaction_id: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCheckResponse {
    pub id: String,
    pub entity: crate::types::SabmonitorCheck,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCheckResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<crate::types::SabmonitorCheck>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
