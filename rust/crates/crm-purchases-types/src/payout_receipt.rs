//! §2.5 Payout Receipts.
//!
//! Mongo collection: `crm_payouts`. Vendor-side mirror of `PaymentReceipt`
//! (§1.7) — money flows out of our bank to settle bills.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, Identity, LineageRef};
use crm_sales_types::PaymentMode;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PayoutStatus {
    #[default]
    Sent,
    Cleared,
    /// Bank rejected (insufficient funds / wrong details / cheque
    /// bounced).
    Failed,
}

/// One row of the payout → bill allocation table.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BillApplication {
    pub bill_id: ObjectId,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayoutReceipt {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- doc number + dates ------------------------------------ */
    pub payment_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,

    /* ----- parties + accounts ------------------------------------ */
    pub vendor_id: ObjectId,
    pub mode: PaymentMode,
    /// FK into `crm_payment_accounts` — the bank/UPI/wallet account
    /// the money was paid out from.
    pub bank_account_id: ObjectId,

    /* ----- mode-specific details --------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cheque_no: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub cheque_date: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub txn_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,

    /* ----- amounts ----------------------------------------------- */
    pub amount: f64,
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,

    /* ----- allocation -------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub apply_to: Vec<BillApplication>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub excess_as_advance: bool,

    /* ----- adjustments ------------------------------------------- */
    /// TDS we deducted at source from the vendor's payable. Booked to
    /// the TDS payable ledger.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_deducted: Option<f64>,

    /* ----- doc body --------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    /* ----- workflow + lineage ------------------------------------ */
    #[serde(default)]
    pub status: PayoutStatus,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}

fn is_false(b: &bool) -> bool {
    !*b
}
