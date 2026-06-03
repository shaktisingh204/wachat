//! Wire-format DTOs for the SabCRM settings HTTP surface.
//!
//! There is one document per project — `{ _id, projectId, data, updatedAt }` —
//! where `data` is a free-form key/value map. Responses always return just the
//! merged `data` map under a `{ data }` envelope.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use utoipa::ToSchema;

/// `GET /` query params — read the project's settings.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `PUT /` query params — the tenant scope for the upsert.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateQuery {
    /// Tenant scope — required (mirrors the body `projectId`).
    pub project_id: String,
}

/// `PUT /` body — merge these keys into the project's settings `data`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Free-form key/value patch; each key is `$set` onto `data`.
    #[schema(value_type = Object)]
    pub data: Map<String, Value>,
}

/// Response body for `GET /` and `PUT /` — the project's settings `data`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SettingsResponse {
    /// The free-form settings map (`{}` when the project has none yet).
    #[schema(value_type = Object)]
    pub data: Map<String, Value>,
}
