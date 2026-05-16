//! Request DTOs.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::CrmAutoLeadRule;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub assign_to_team: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRuleInput {
    pub name: String,
    #[serde(default)]
    pub conditions: Option<Vec<Document>>,
    #[serde(default)]
    pub assign_to_user_id: Option<String>,
    #[serde(default)]
    pub assign_to_team: Option<String>,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub execution_order: Option<i32>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRuleInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub conditions: Option<Vec<Document>>,
    #[serde(default)]
    pub assign_to_user_id: Option<String>,
    #[serde(default)]
    pub assign_to_team: Option<String>,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub execution_order: Option<i32>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRuleResponse {
    pub id: String,
    pub entity: CrmAutoLeadRule,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRuleResponse {
    pub deleted: bool,
}
