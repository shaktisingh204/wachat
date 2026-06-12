//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::{CrmProformaInvoice, ProformaLineItem};

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
    pub account_id: Option<String>,
    /// SabCRM (project) mounts only — required there, ignored on legacy.
    #[serde(default)]
    pub project_id: Option<String>,
}

/// Scope carrier for get/update/delete on SabCRM (project) mounts —
/// `?projectId=<oid>`. Ignored on the legacy (`userId`) mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProformaInput {
    pub proforma_number: String,
    /// SabCRM (project) mounts only — required there, ignored on legacy.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub account_id: Option<String>,
    pub proforma_date: String,
    #[serde(default)]
    pub valid_till_date: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    /* ----- canonical advance fields (finance-rollout gap G3) ------ */
    /// Hex `ObjectId` of the linked Sales Order.
    #[serde(default)]
    pub linked_so_id: Option<String>,
    /// Advance %. Must be a finite number in `[0, 100]` when present.
    /// When sent without `advanceAmount`, the handler computes
    /// `advanceAmount = total × advancePct / 100`.
    #[serde(default)]
    pub advance_pct: Option<f64>,
    #[serde(default)]
    pub advance_amount: Option<f64>,
    /// RFC3339 date string.
    #[serde(default)]
    pub payment_due_date: Option<String>,
    /// RFC3339 date string.
    #[serde(default)]
    pub expected_delivery: Option<String>,
    #[serde(default)]
    pub line_items: Vec<ProformaLineItem>,
    #[serde(default)]
    pub terms_and_conditions: Vec<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub tax_total: Option<f64>,
    #[serde(default)]
    pub discount_total: Option<f64>,
    #[serde(default)]
    pub design_metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProformaInput {
    #[serde(default)]
    pub proforma_number: Option<String>,
    #[serde(default)]
    pub account_id: Option<String>,
    #[serde(default)]
    pub proforma_date: Option<String>,
    #[serde(default)]
    pub valid_till_date: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    /* ----- canonical advance fields (finance-rollout gap G3) ------ */
    /// Hex `ObjectId` of the linked Sales Order.
    #[serde(default)]
    pub linked_so_id: Option<String>,
    /// Advance %. Must be a finite number in `[0, 100]` when present.
    #[serde(default)]
    pub advance_pct: Option<f64>,
    #[serde(default)]
    pub advance_amount: Option<f64>,
    /// RFC3339 date string.
    #[serde(default)]
    pub payment_due_date: Option<String>,
    /// RFC3339 date string.
    #[serde(default)]
    pub expected_delivery: Option<String>,
    #[serde(default)]
    pub line_items: Option<Vec<ProformaLineItem>>,
    #[serde(default)]
    pub terms_and_conditions: Option<Vec<String>>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub tax_total: Option<f64>,
    #[serde(default)]
    pub discount_total: Option<f64>,
    #[serde(default)]
    pub design_metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProformaResponse {
    pub id: String,
    pub entity: CrmProformaInvoice,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProformaResponse {
    pub deleted: bool,
}
