//! On-disk shape of a `crm_chart_of_accounts` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// A single ledger head (chart-of-account row).
///
/// Legacy documents in `crm_chart_of_accounts` carry a broader set of
/// fields (`balanceType`, `description`, `status: "Active"|"Inactive"`),
/// but the canonical Rust shape narrows to the fields the Next.js layer
/// actually relies on for CRUD. Unknown fields round-trip through serde
/// because we only `$set` what the patch DTO supplies.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmChartOfAccount {
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

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,

    /// FK into `crm_account_groups`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_group_id: Option<ObjectId>,

    /// `"asset"` | `"liability"` | `"income"` | `"expense"` | `"equity"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_type: Option<String>,

    /// Optional parent CoA for hierarchical rollup.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opening_balance: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(default = "default_active")]
    pub is_active: bool,

    /// `"active"` | `"archived"`. Soft-delete uses `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_active() -> bool {
    true
}
