use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub endpoint_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertHardwareInput {
    pub endpoint_id: String,
    #[serde(default)]
    pub cpu: Option<String>,
    #[serde(default)]
    pub ram_gb: Option<f64>,
    #[serde(default)]
    pub disk_gb: Option<f64>,
    #[serde(default)]
    pub gpu: Option<String>,
    #[serde(default)]
    pub battery_health: Option<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertHardwareResponse {
    pub id: String,
    pub entity: crate::types::SabopsHardware,
}
