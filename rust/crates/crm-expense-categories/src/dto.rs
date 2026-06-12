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
    /// SabCRM (project) mounts only — required there, ignored on legacy
    /// (finance-rollout gap G5).
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateExpenseCategoryInput {
    pub name: String,
    /// SabCRM (project) mounts only — the tenancy key, required there
    /// and ignored on the legacy (`userId`) mount (finance-rollout gap
    /// G5).
    #[serde(default)]
    pub project_id: Option<String>,
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

/// Scope carrier for get/update/delete on SabCRM (project) mounts —
/// `?projectId=<oid>`. Ignored on the legacy (`userId`) mount
/// (finance-rollout gap G5).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// G5 — `projectId` rides the camelCase wire on the list query, the
    /// create body, and the standalone scope carrier.
    #[test]
    fn project_id_round_trips_camel_case() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({
            "projectId": "507f1f77bcf86cd799439011",
            "q": "travel",
        }))
        .unwrap();
        assert_eq!(q.project_id.as_deref(), Some("507f1f77bcf86cd799439011"));

        let input: CreateExpenseCategoryInput = serde_json::from_value(serde_json::json!({
            "name": "Travel",
            "projectId": "507f1f77bcf86cd799439011",
        }))
        .unwrap();
        assert_eq!(
            input.project_id.as_deref(),
            Some("507f1f77bcf86cd799439011")
        );

        let sq: ScopeQuery = serde_json::from_value(serde_json::json!({
            "projectId": "507f1f77bcf86cd799439011",
        }))
        .unwrap();
        assert_eq!(sq.project_id.as_deref(), Some("507f1f77bcf86cd799439011"));
    }

    /// G5 — legacy bodies without `projectId` keep deserialising; the
    /// new field defaults to `None` everywhere.
    #[test]
    fn project_id_defaults_to_none() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(q.project_id.is_none());

        let input: CreateExpenseCategoryInput =
            serde_json::from_value(serde_json::json!({ "name": "Meals" })).unwrap();
        assert!(input.project_id.is_none());

        let sq: ScopeQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(sq.project_id.is_none());
    }
}
