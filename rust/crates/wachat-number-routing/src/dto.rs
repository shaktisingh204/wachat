//! Wire DTOs for the number-routing endpoints. `camelCase` to match the
//! JSON the /wachat/two-line page sends.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Body for `POST /` (create) and `PUT /{id}` (update).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BindingBody {
    /// Human label for this line (e.g. "Sales line").
    pub label: String,
    /// WABA phone-number id this binding routes for.
    pub phone_number_id: String,
    /// Optional assigned team id (hex string or free-form id). `None`/empty clears it.
    #[serde(default)]
    pub team_id: Option<String>,
    /// Default route for inbound messages on this number: `"bot"` or `"agent"`.
    pub default_route: String,
}

/// Response for `GET /` — the caller's bindings as cleaned JSON docs.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListBindingsResponse {
    #[schema(value_type = Vec<Object>)]
    pub bindings: Vec<Value>,
}

/// `{ success: true }` envelope for PUT / DELETE.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
