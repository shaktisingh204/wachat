//! Wire DTOs for the wachat-ai-training endpoints. `camelCase` to match the
//! JSON the `/wachat/automation` page sends/expects (model picker +
//! question/answer training samples).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Body for `POST /model-config/{project_id}/{phone_id}` — upsert the
/// automation model for a number. `model` is `"meta-native"` or
/// `"sabnode-ai"`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfigBody {
    /// Automation engine: `"meta-native"` or `"sabnode-ai"`.
    pub model: String,
}

/// Response for `GET /model-config/{project_id}/{phone_id}` — the selected
/// model (defaults to `"meta-native"` when no config doc exists).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfigResponse {
    /// Automation engine: `"meta-native"` or `"sabnode-ai"`.
    pub model: String,
}

/// Body for `POST /samples/{project_id}/{phone_id}` — create one training
/// sample (a question/ideal-answer pair).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SampleBody {
    /// Customer question to train against.
    pub question: String,
    /// Ideal answer the assistant should give.
    pub answer: String,
}

/// Response for `GET /samples/{project_id}/{phone_id}` — the caller's saved
/// samples as cleaned JSON docs.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListSamplesResponse {
    #[schema(value_type = Vec<Object>)]
    pub samples: Vec<Value>,
}

/// `{ success: true }` envelope for mutations.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
