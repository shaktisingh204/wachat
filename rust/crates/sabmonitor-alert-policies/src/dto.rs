use serde::{Deserialize, Serialize};
use crate::types::{AlertChannel, AlertConditions};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePolicyInput {
    pub name: String,
    #[serde(default)]
    pub check_ids: Vec<String>,
    #[serde(default)]
    pub tag_selector: Option<String>,
    #[serde(default)]
    pub conditions: AlertConditions,
    #[serde(default)]
    pub channels: Vec<AlertChannel>,
    #[serde(default)]
    pub escalate_after_min: Option<i32>,
    #[serde(default)]
    pub escalate_to: Vec<AlertChannel>,
    #[serde(default)]
    pub status: Option<String>,
}

impl Default for AlertConditions {
    fn default() -> Self {
        Self { down_count: None, slow_ms: None, ssl_expiring_days: None }
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePolicyInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub check_ids: Option<Vec<String>>,
    #[serde(default)]
    pub tag_selector: Option<String>,
    #[serde(default)]
    pub conditions: Option<AlertConditions>,
    #[serde(default)]
    pub channels: Option<Vec<AlertChannel>>,
    #[serde(default)]
    pub escalate_after_min: Option<i32>,
    #[serde(default)]
    pub escalate_to: Option<Vec<AlertChannel>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePolicyResponse {
    pub id: String,
    pub entity: crate::types::SabmonitorAlertPolicy,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePolicyResponse { pub deleted: bool }

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<crate::types::SabmonitorAlertPolicy>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
