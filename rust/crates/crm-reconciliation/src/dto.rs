//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmReconciliation;

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
    /// Filter by ledger account (ObjectId hex). Invalid hex is ignored.
    #[serde(default)]
    pub account_id: Option<String>,
    /// SabCRM (project) mounts only — required there, ignored on legacy.
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReconciliationInput {
    pub account_id: String,
    pub period_start: String,
    pub period_end: String,
    #[serde(default)]
    pub opening_balance: Option<f64>,
    #[serde(default)]
    pub closing_balance: Option<f64>,
    #[serde(default)]
    pub matched_count: Option<i64>,
    #[serde(default)]
    pub unmatched_count: Option<i64>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    /// SabCRM (project) mounts only — required there, ignored on legacy.
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateReconciliationInput {
    #[serde(default)]
    pub account_id: Option<String>,
    #[serde(default)]
    pub period_start: Option<String>,
    #[serde(default)]
    pub period_end: Option<String>,
    #[serde(default)]
    pub opening_balance: Option<f64>,
    #[serde(default)]
    pub closing_balance: Option<f64>,
    #[serde(default)]
    pub matched_count: Option<i64>,
    #[serde(default)]
    pub unmatched_count: Option<i64>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub finalized_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReconciliationResponse {
    pub id: String,
    pub entity: CrmReconciliation,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteReconciliationResponse {
    pub deleted: bool,
}

/// Scope carrier for get/update/delete on SabCRM (project) mounts —
/// `?projectId=<oid>`. Ignored on the legacy (`userId`) mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}
