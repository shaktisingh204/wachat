//! Request / response DTOs.

use serde::{Deserialize, Serialize};

use crate::types::SablensAnnotation;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAnnotationInput {
    pub session_id: String,
    #[serde(default)]
    pub slide_or_frame_id: Option<String>,
    pub kind: String,
    pub geometry_json: serde_json::Value,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub stroke_width: Option<f32>,
    #[serde(default)]
    pub persistent: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAnnotationResponse {
    pub id: String,
    pub entity: SablensAnnotation,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAnnotationResponse {
    pub deleted: bool,
}
