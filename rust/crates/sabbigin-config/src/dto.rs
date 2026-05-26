//! Request DTOs — what callers send IN.

use serde::{Deserialize, Serialize};

use crate::types::SabbiginConfig;

/// `GET /v1/sabbigin/config?…`
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// `"active"` | `"archived"` | `"all"`. Defaults to `"active"`.
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /v1/sabbigin/config` body.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSabbiginConfigInput {
    #[serde(default)]
    pub enabled: Option<bool>,
    /// Hex `ObjectId` — the pipeline SabBigin should surface.
    #[serde(default)]
    pub pipeline_id: Option<String>,
    /// Defaults to `1`.
    #[serde(default)]
    pub pipeline_limit: Option<u32>,
    /// Defaults to `SabbiginConfig::default_features()`.
    #[serde(default)]
    pub allowed_features: Option<Vec<String>>,
}

/// `PATCH /v1/sabbigin/config/:id` body. Every field optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSabbiginConfigInput {
    #[serde(default)]
    pub enabled: Option<bool>,
    /// Empty string clears the pipeline binding.
    #[serde(default)]
    pub pipeline_id: Option<String>,
    #[serde(default)]
    pub pipeline_limit: Option<u32>,
    #[serde(default)]
    pub allowed_features: Option<Vec<String>>,
    /// Allow `"active"` ↔ `"archived"` transitions via PATCH.
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /v1/sabbigin/config` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSabbiginConfigResponse {
    pub id: String,
    pub entity: SabbiginConfig,
}

/// `DELETE /v1/sabbigin/config/:id` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSabbiginConfigResponse {
    pub deleted: bool,
}
