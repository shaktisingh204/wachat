use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum FieldType {
    Text,
    Signature,
    Date,
    Checkbox,
    Dropdown,
    Radio,
    Initials,
    FileAttachment,
    Company,
    JobTitle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Coordinate {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dimensions {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageMapping {
    pub page_number: u32,
    pub width: f64,
    pub height: f64,
    pub rotation: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasField {
    pub id: Uuid,
    pub form_id: Uuid,
    pub field_type: FieldType,
    pub label: String,
    pub value: Option<String>,
    pub required: bool,
    pub assignee_id: Option<Uuid>,
    pub coordinate: Coordinate,
    pub dimensions: Dimensions,
    pub page_mapping: PageMapping,
    pub relative_x: f64,
    pub relative_y: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormTemplate {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub document_id: String, // PDF Document ID
    pub pages_count: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_draft: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldAnalytics {
    pub field_id: Uuid,
    pub interactions: u32,
    pub average_time_spent_ms: u64,
    pub drop_off_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormAnalytics {
    pub form_id: Uuid,
    pub total_views: u32,
    pub total_completions: u32,
    pub average_completion_time_ms: u64,
    pub field_metrics: Vec<FieldAnalytics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalculateRelativePositionRequest {
    pub coordinate: Coordinate,
    pub page_width: f64,
    pub page_height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalculateRelativePositionResponse {
    pub relative_x: f64,
    pub relative_y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkActionResponse {
    pub success: bool,
    pub processed: usize,
    pub failed: usize,
}
