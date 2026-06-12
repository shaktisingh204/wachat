//! On-disk shape of a `crm_voucher_entries` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// A single line within a voucher entry — either a debit or a credit.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoucherLine {
    #[serde(rename = "accountId")]
    pub account_id: ObjectId,
    pub amount: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmVoucherEntry {
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

    #[serde(rename = "voucherBookId")]
    pub voucher_book_id: ObjectId,
    pub voucher_number: String,
    pub date: BsonDateTime,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub narration: Option<String>,

    #[serde(default)]
    pub debit_entries: Vec<VoucherLine>,
    #[serde(default)]
    pub credit_entries: Vec<VoucherLine>,

    pub total_debit: f64,
    pub total_credit: f64,

    /// `"posted"` | `"draft"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
