//! On-disk shape of a `crm_reconciliations` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmReconciliation {
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

    /// Ledger account this run is reconciling (typically a bank account).
    pub account_id: ObjectId,

    /// Inclusive start of the reconciliation window.
    pub period_start: BsonDateTime,
    /// Inclusive end of the reconciliation window.
    pub period_end: BsonDateTime,

    /// Book balance carried in at `periodStart`.
    pub opening_balance: f64,
    /// Statement balance at `periodEnd`.
    pub closing_balance: f64,

    /// Number of statement lines that were matched to book entries.
    #[serde(default)]
    pub matched_count: i64,
    /// Number of statement lines still outstanding.
    #[serde(default)]
    pub unmatched_count: i64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `"in_progress"` | `"completed"` | `"archived"`.
    pub status: String,

    /// Set when `status` transitions to `"completed"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finalized_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
