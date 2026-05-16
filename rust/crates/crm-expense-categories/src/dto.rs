//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmExpenseCategory;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` (default, excludes archived) | `"archived"` | `"all"`.
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub is_billable: Option<bool>,
    #[serde(default)]
    pub is_reimbursable: Option<bool>,
    /// Filter by parent. Pass `"none"` / `"null"` to match top-level categories,
    /// or a hex ObjectId string for a specific parent.
    #[serde(default)]
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateExpenseCategoryInput {
    pub name: String,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub default_account_id: Option<String>,
    #[serde(default)]
    pub tax_rate: Option<f64>,
    #[serde(default)]
    pub is_billable: Option<bool>,
    #[serde(default)]
    pub is_reimbursable: Option<bool>,
    #[serde(default)]
    pub max_amount: Option<f64>,
    #[serde(default)]
    pub requires_receipt_above: Option<f64>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateExpenseCategoryInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub default_account_id: Option<String>,
    #[serde(default)]
    pub tax_rate: Option<f64>,
    #[serde(default)]
    pub is_billable: Option<bool>,
    #[serde(default)]
    pub is_reimbursable: Option<bool>,
    #[serde(default)]
    pub max_amount: Option<f64>,
    #[serde(default)]
    pub requires_receipt_above: Option<f64>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateExpenseCategoryResponse {
    pub id: String,
    pub entity: CrmExpenseCategory,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteExpenseCategoryResponse {
    pub deleted: bool,
}
