//! Wire DTOs for the interactive-builder endpoints. `camelCase` to match the
//! JSON the `/wachat/templates/interactive-message-builder` page sends.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Query for `GET /templates` — project scope.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTemplatesQuery {
    /// Project the saved templates belong to.
    pub project_id: String,
}

/// Body for `POST /templates` — save a named interactive-message layout.
///
/// `payload` is the free-form `InteractiveMessageState` the builder page holds
/// (`{ msgType, body, buttons, sections, flowId, flowCta, flowToken,
/// carouselCards }`). Stored verbatim as JSON.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SaveTemplateBody {
    /// Project the template is scoped to.
    pub project_id: String,
    /// Human label for the saved template (e.g. "Support Menu").
    pub name: String,
    /// The interactive-message state to persist (free-form JSON).
    #[schema(value_type = Object)]
    pub payload: Value,
}

/// Response for `GET /templates` — the caller's saved templates as cleaned docs.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTemplatesResponse {
    #[schema(value_type = Vec<Object>)]
    pub templates: Vec<Value>,
}

/// `{ success: true }` envelope for DELETE.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
