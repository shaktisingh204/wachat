//! On-disk shape of a `crm_account_groups` document.
//!
//! Account Group is the top-level node in the chart of accounts. Each group
//! carries a `nature` (asset / liability / income / expense / equity) which
//! drives downstream accounting reports (Trial Balance, P&L, Balance Sheet).
//! Groups may nest via `parent_group_id` to support sub-grouping.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmAccountGroup {
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

    /// Human label, e.g. "Current Assets", "Sales", "Operating Expenses".
    pub name: String,

    /// Optional short ledger code, e.g. "1000", "CA-01".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,

    /// `"asset"` | `"liability"` | `"income"` | `"expense"` | `"equity"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nature: Option<String>,

    /// Parent group id when this group nests under another (hierarchy).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_group_id: Option<ObjectId>,

    /// Flag distinct from `status` — UI-level enable/disable switch.
    #[serde(default = "default_true")]
    pub is_active: bool,

    /// `"active"` | `"archived"`. Soft-delete sets this to `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
