use serde::{Deserialize, Serialize};
use crate::types::SabsenseTargeting;

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
    #[serde(default)]
    pub locations: Vec<String>,
    #[serde(default)]
    pub device_types: Vec<String>,
    #[serde(default)]
    pub age_ranges: Vec<String>,
    #[serde(default)]
    pub interests: Vec<String>,
    #[serde(default)]
    pub status: Option<String>,

}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInput {
    #[serde(default)]
    pub campaign_id: Option<String>,
    #[serde(default)]
    pub locations: Option<Vec<String>>,
    #[serde(default)]
    pub device_types: Option<Vec<String>>,
    #[serde(default)]
    pub age_ranges: Option<Vec<String>>,
    #[serde(default)]
    pub interests: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,

}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResponse {
    pub id: String,
    pub entity: SabsenseTargeting,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub deleted: bool,
}
