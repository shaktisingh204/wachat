use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSettings {
    pub id: String,
    pub name: String,
    pub timezone: String,
    pub business_hours: BusinessHours,
    pub default_language: String,
    pub allowed_domains: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessHours {
    pub enabled: bool,
    pub schedule: HashMap<String, DaySchedule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaySchedule {
    pub start: String,
    pub end: String,
    pub is_working_day: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomFormSchema {
    pub id: String,
    pub form_name: String,
    pub fields: Vec<FormField>,
    pub target_entity: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormField {
    pub field_id: String,
    pub field_type: String,
    pub label: String,
    pub required: bool,
    pub options: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelConfiguration {
    pub id: String,
    pub channel_type: ChannelType,
    pub is_active: bool,
    pub config: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChannelType {
    Email,
    Chat,
    Social,
    Api,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Team {
    pub id: String,
    pub name: String,
    pub description: String,
    pub members: Vec<String>, // User IDs
    pub lead_id: Option<String>,
    pub skills: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RolePermission {
    pub id: String,
    pub role_name: String,
    pub permissions: Vec<String>,
    pub is_system_role: bool,
}

// Request and Response Structs for Handlers

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWorkspaceSettingsReq {
    pub name: String,
    pub timezone: String,
    pub default_language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateWorkspaceSettingsReq {
    pub name: Option<String>,
    pub timezone: Option<String>,
    pub default_language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCustomFormSchemaReq {
    pub form_name: String,
    pub target_entity: String,
    pub fields: Vec<FormField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateChannelConfigurationReq {
    pub channel_type: ChannelType,
    pub is_active: bool,
    pub config: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTeamReq {
    pub name: String,
    pub description: String,
    pub skills: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddTeamMemberReq {
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRolePermissionReq {
    pub role_name: String,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageResponse {
    pub message: String,
}
