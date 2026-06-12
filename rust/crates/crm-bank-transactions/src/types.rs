//! On-disk shape of a `crm_bank_transactions` document.
//!
//! Mirrors `src/app/actions/crm-bank-transactions.actions.ts` —
//! `amount` is always stored positive; sign is conveyed by `type`
//! (`"debit"` | `"credit"`). `accountId` is a ref to `crm_payment_accounts`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmBankTransaction {
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

    #[serde(rename = "accountId")]
    pub account_id: ObjectId,
    #[serde(rename = "transactionDate")]
    pub transaction_date: BsonDateTime,
    pub amount: f64,
    /// `"debit"` | `"credit"` (lowercase, matches the TS action file).
    #[serde(rename = "type")]
    pub kind: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub balance_after: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    /// Optional link back to the voucher entry that produced this row.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voucher_entry_id: Option<ObjectId>,

    /// `"pending"` | `"cleared"` | `"reconciled"` | `"archived"`.
    pub status: String,

    /// Sab-file URL for the source statement (CSV/PDF). Optional.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_file_url: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt")]
    pub updated_at: BsonDateTime,
}
