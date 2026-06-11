//! Request DTOs — what callers send IN.

use serde::{Deserialize, Serialize};

use crate::types::{OnboardingState, PublicBranding, SabbiginConfig};

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
    /// Hex `ObjectId` — the pipeline the deals board defaults to.
    #[serde(default)]
    pub pipeline_id: Option<String>,
    /// `0` (default) means "no admin override".
    #[serde(default)]
    pub pipeline_limit: Option<u32>,
    /// Defaults to `SabbiginConfig::default_features()`.
    #[serde(default)]
    pub allowed_features: Option<Vec<String>>,
    #[serde(default)]
    pub default_currency: Option<String>,
    #[serde(default)]
    pub multi_currency: Option<bool>,
    #[serde(default)]
    pub email_in_enabled: Option<bool>,
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
    #[serde(default)]
    pub default_currency: Option<String>,
    #[serde(default)]
    pub multi_currency: Option<bool>,
    #[serde(default)]
    pub email_in_enabled: Option<bool>,
    #[serde(default)]
    pub public_branding: Option<PublicBranding>,
    #[serde(default)]
    pub onboarding: Option<OnboardingState>,
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
