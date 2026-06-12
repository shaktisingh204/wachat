//! On-disk shape of a `crm_expense_categories` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmExpenseCategory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM tenancy key (finance-rollout gap G5) — populated only on
    /// documents created through the project-scoped mount. Legacy
    /// documents never carried it, so it is optional + defaulted and
    /// they deserialize unchanged.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,

    /// Display name. Unique per tenant among non-archived categories.
    pub name: String,
    /// Optional short code (e.g. "TRAVEL", "MEAL-01"). Free-form; not enforced unique.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,

    /// Parent category for nested classification (e.g. "Travel" -> "Flights").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Default GL account; links into `crm_chart_of_accounts`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_account_id: Option<ObjectId>,

    /// Default tax rate (percentage, e.g. 18.0 for 18%).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_rate: Option<f64>,

    /// Whether expenses in this category are normally billable to a client.
    #[serde(default)]
    pub is_billable: bool,

    /// Whether expenses in this category are reimbursable to the employee.
    #[serde(default = "default_true")]
    pub is_reimbursable: bool,

    /// Per-expense ceiling (max amount allowed on a single expense line).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_amount: Option<f64>,

    /// Threshold above which a receipt attachment is mandatory.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requires_receipt_above: Option<f64>,

    /// Hex string (e.g. "#FF8800") or zoru token name.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// Icon identifier (lucide name, emoji, or zoru icon token).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,

    /// Soft on/off toggle. Distinct from `status` archival.
    #[serde(default = "default_true")]
    pub is_active: bool,

    /// `"active"` | `"archived"`. Archive = soft delete.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
