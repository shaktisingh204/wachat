//! Request DTOs for sabtables automations.

use serde::{Deserialize, Serialize};

use crate::types::{SabtablesAutomation, SabtablesAutomationAction, SabtablesAutomationTrigger};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub table_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAutomationInput {
    pub table_id: String,
    pub name: String,
    pub trigger: SabtablesAutomationTrigger,
    #[serde(default)]
    pub actions: Vec<SabtablesAutomationAction>,
    #[serde(default)]
    pub is_enabled: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAutomationInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub trigger: Option<SabtablesAutomationTrigger>,
    #[serde(default)]
    pub actions: Option<Vec<SabtablesAutomationAction>>,
    #[serde(default)]
    pub is_enabled: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAutomationInput {
    /// Optional record id to use as the trigger payload during a manual
    /// "run now" test.
    #[serde(default)]
    pub record_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAutomationResponse {
    pub id: String,
    pub entity: SabtablesAutomation,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAutomationResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAutomationResponse {
    pub run_id: String,
    pub steps_executed: u32,
    pub status: String,
}
