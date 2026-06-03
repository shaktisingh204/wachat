use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Template {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_active: bool,
    pub tags: Vec<String>,
    pub version: u32,
    pub roles: Vec<RoleTemplate>,
    pub merge_fields: Vec<MergeField>,
    pub settings: TemplateSettings,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TemplateSettings {
    pub allow_reminders: bool,
    pub days_until_expiration: u32,
    pub require_all_signers: bool,
    pub auto_navigation: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RoleTemplate {
    pub role_id: Uuid,
    pub role_name: String,
    pub action: String, // e.g., "sign", "view", "approve"
    pub routing_order: u32,
    pub message: Option<String>,
    pub default_recipient_name: Option<String>,
    pub default_recipient_email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MergeField {
    pub field_id: Uuid,
    pub role_id: Uuid,
    pub field_type: String, // e.g., "text", "signature", "date"
    pub field_name: String,
    pub label: String,
    pub is_required: bool,
    pub value: Option<String>,
    pub x_position: f64,
    pub y_position: f64,
    pub page_number: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TemplateVersion {
    pub version_id: Uuid,
    pub template_id: Uuid,
    pub version_number: u32,
    pub created_at: DateTime<Utc>,
    pub created_by: Uuid,
    pub snapshot: Template,
    pub change_log: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Envelope {
    pub envelope_id: Uuid,
    pub template_id: Option<Uuid>,
    pub status: String, // e.g., "draft", "sent", "completed"
    pub created_at: DateTime<Utc>,
    pub custom_fields: HashMap<String, String>,
}

// Request and Response Structs

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub roles: Vec<RoleTemplate>,
    pub merge_fields: Vec<MergeField>,
    pub settings: TemplateSettings,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateTemplateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
    pub roles: Option<Vec<RoleTemplate>>,
    pub merge_fields: Option<Vec<MergeField>>,
    pub settings: Option<TemplateSettings>,
    pub tags: Option<Vec<String>>,
    pub change_log: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CloneTemplateRequest {
    pub new_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApplyTemplateRequest {
    pub envelope_id: Uuid,
    pub role_assignments: HashMap<Uuid, RecipientInfo>, // Role ID to Recipient
    pub field_values: HashMap<Uuid, String>,            // Field ID to Value
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecipientInfo {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BulkCreateRequest {
    pub templates: Vec<CreateTemplateRequest>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BulkActionResponse {
    pub success_count: usize,
    pub failed_count: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: usize,
    pub page: usize,
    pub limit: usize,
}
