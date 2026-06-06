//! Wire DTOs for the opt-out-settings endpoints. `camelCase` to match the
//! JSON the `/wachat/opt-out` page (AI Settings panel) sends/expects.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Body for `POST /projects/{project_id}` — upsert the project-level
/// opt-out settings. All fields optional so partial updates are cheap;
/// unspecified flags keep their current (or default) value.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct OptOutSettingsBody {
    /// Auto-add inbound contacts to the opt-out list when sentiment analysis
    /// detects an unsubscribe intent (e.g. "stop messaging me").
    #[serde(default)]
    pub sentiment_auto_opt_out: Option<bool>,
}

/// Response for `GET /projects/{project_id}` — the cleaned settings doc, or
/// sensible defaults when none has been saved yet.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct OptOutSettingsResponse {
    #[schema(value_type = Object)]
    pub settings: Value,
}

/// `{ success: true }` envelope for the upsert mutation.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
