//! Request DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub location_id: Option<String>,
    #[serde(default)]
    pub provider_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertProviderInput {
    pub location_id: String,
    pub provider_id: String,
    #[serde(default)]
    pub connection_status: Option<String>,
    #[serde(default)]
    pub external_listing_id: Option<String>,
    #[serde(default)]
    pub credentials_ref: Option<String>,
    #[serde(default)]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProviderInput {
    #[serde(default)]
    pub connection_status: Option<String>,
    #[serde(default)]
    pub external_listing_id: Option<String>,
    #[serde(default)]
    pub credentials_ref: Option<String>,
    #[serde(default)]
    pub error_message: Option<String>,
    #[serde(default)]
    pub last_sync_at_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertProviderResponse {
    pub id: String,
    pub entity: crate::types::SabpublishProvider,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProviderResponse {
    pub deleted: bool,
}
