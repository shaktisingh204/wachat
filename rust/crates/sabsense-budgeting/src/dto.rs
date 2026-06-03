use serde::{Deserialize, Serialize};
use crate::types::SabsenseBudgeting;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInput {
    pub campaign_id: String,
    pub daily_budget_minor: i64,
    pub total_budget_minor: i64,
    pub spend_minor: i64,
    pub bidding_strategy: String,
    #[serde(default)]
    pub status: Option<String>,

}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInput {
    #[serde(default)]
    pub campaign_id: Option<String>,
    #[serde(default)]
    pub daily_budget_minor: Option<i64>,
    #[serde(default)]
    pub total_budget_minor: Option<i64>,
    #[serde(default)]
    pub spend_minor: Option<i64>,
    #[serde(default)]
    pub bidding_strategy: Option<String>,
    #[serde(default)]
    pub status: Option<String>,

}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResponse {
    pub id: String,
    pub entity: SabsenseBudgeting,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub deleted: bool,
}
