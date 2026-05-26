//! Wire-format DTOs for the SabChat marketplace endpoints.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to match Next.js side.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Marketplace — POST bodies
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/marketplace` — install an app.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InstallAppBody {
    pub app_id: String,
    pub name: String,
    #[serde(default)]
    pub configuration: Option<Value>,
}

// ---------------------------------------------------------------------------
// Marketplace — responses
// ---------------------------------------------------------------------------

/// Response for `POST /v1/sabchat/marketplace`. Echoes the new installation id.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InstallAppResponse {
    pub installed_app_id: String,
}

/// Response body for `GET /v1/sabchat/marketplace`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListInstalledAppsResponse {
    #[schema(value_type = Vec<Object>)]
    pub apps: Vec<Value>,
}

/// Response body for `GET /v1/sabchat/marketplace/{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetInstalledAppResponse {
    #[schema(value_type = Object)]
    pub app: Value,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by DELETE endpoints.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
