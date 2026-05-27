use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// `ongoing` | `resolved` | `all` (default `all`).
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub check_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIncidentInput {
    pub check_id: String,
    pub severity: String,
    #[serde(default)]
    pub root_cause_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIncidentResponse {
    pub id: String,
    pub entity: crate::types::SabmonitorIncident,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<crate::types::SabmonitorIncident>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AckResponse {
    pub entity: crate::types::SabmonitorIncident,
}
