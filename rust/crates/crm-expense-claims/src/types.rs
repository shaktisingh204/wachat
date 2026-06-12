//! On-disk shape of a `crm_expense_claims` document.
//!
//! Field names are snake_case to match the TS source-of-truth in
//! `src/app/actions/crm-expense-claims.actions.ts`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CrmExpenseClaim {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// SabCRM tenancy scope — stamped on documents created through the
    /// project (`/v1/sabcrm/finance/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    pub employee_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,

    /// Auto-generated `EC-YYYYMM-NNNN`.
    pub claim_number: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category_name: Option<String>,

    pub amount: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expense_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// SabFile URL (validated in TS — Rust just stores the string).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub receipt_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub receipt_name: Option<String>,

    /// `"draft"` | `"submitted"` | `"approved"` | `"rejected"`
    /// | `"reimbursed"` | `"cancelled"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_name: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
