//! Request DTOs for `/v1/mail/rules`.

use serde::{Deserialize, Serialize};

use crate::types::{RuleAction, RuleCondition};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRuleInput {
    pub account_id: String,
    pub name: String,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub match_mode: Option<String>,
    #[serde(default)]
    pub conditions: Vec<RuleCondition>,
    #[serde(default)]
    pub actions: Vec<RuleAction>,
    #[serde(default)]
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRuleInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub match_mode: Option<String>,
    #[serde(default)]
    pub conditions: Option<Vec<RuleCondition>>,
    #[serde(default)]
    pub actions: Option<Vec<RuleAction>>,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRuleResponse {
    pub id: String,
    pub entity: crate::types::MailRule,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRuleResponse {
    pub deleted: bool,
}
