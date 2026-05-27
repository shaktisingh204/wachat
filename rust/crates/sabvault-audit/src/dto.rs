use serde::{Deserialize, Serialize};

use crate::types::{AuditAction, SabvaultAuditEntry};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub secret_id: Option<String>,
    #[serde(default)]
    pub actor_user_id: Option<String>,
    #[serde(default)]
    pub action: Option<AuditAction>,
    /// ISO date — inclusive lower bound.
    #[serde(default)]
    pub from: Option<chrono::DateTime<chrono::Utc>>,
    /// ISO date — exclusive upper bound.
    #[serde(default)]
    pub to: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogAccessInput {
    #[serde(default)]
    pub secret_id: Option<String>,
    pub action: AuditAction,
    #[serde(default)]
    pub ip: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub meta: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogAccessResponse {
    pub id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabvaultAuditEntry>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
