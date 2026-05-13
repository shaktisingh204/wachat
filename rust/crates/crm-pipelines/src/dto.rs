//! Request DTOs — what callers send IN.
//!
//! Responses use the full [`crate::types::Pipeline`].

use serde::{Deserialize, Serialize};

/// Stage shape accepted as part of `POST /v1/crm/pipelines` (initial stages).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStageInline {
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub order: Option<i32>,
    #[serde(default)]
    pub chance: Option<i32>,
}

/// `POST /v1/crm/pipelines` body.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePipelineInput {
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub stages: Vec<CreateStageInline>,
}

/// `PATCH /v1/crm/pipelines/:pipelineId` body. Every field optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePipelineInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
}

/// `POST /v1/crm/pipelines/:pipelineId/stages` body.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddStageInput {
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub order: Option<i32>,
    #[serde(default)]
    pub chance: Option<i32>,
}

/// `PATCH /v1/crm/pipelines/:pipelineId/stages/:stageId` body — every field
/// optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStageInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub order: Option<i32>,
    #[serde(default)]
    pub chance: Option<i32>,
}

/// `POST /v1/crm/pipelines` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePipelineResponse {
    pub id: String,
    /// Echo of the inserted pipeline (with `_id` filled in).
    pub entity: crate::types::Pipeline,
}

/// `POST /v1/crm/pipelines/:pipelineId/stages` response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddStageResponse {
    pub id: String,
    pub entity: crate::types::Stage,
}

/// `DELETE` response for pipeline + stage removal.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub deleted: bool,
}

/// `GET /v1/crm/pipelines` response — flat list (no pagination; embedded
/// arrays are bounded by Mongo doc size).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<crate::types::Pipeline>,
}
