//! §1.7 Payment Receipts.
//!
//! Mongo collection: `crm_payment_receipts`. A single receipt may be
//! split across multiple invoices (`apply_to`) — each `InvoiceApplication`
//! records how much of the receipt was allocated to that invoice.
//! Excess that doesn't apply to any invoice can be parked as a customer
//! advance via `excess_as_advance`.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, Identity, LineageRef};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaymentMode {
    Cash,
    Cheque,
    Upi,
    Neft,
    Rtgs,
    Imps,
    Card,
    Wallet,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReceiptStatus {
    /// Funds noted but not yet confirmed by bank (e.g. cheque deposited
    /// but not cleared).
    #[default]
    Received,
    Cleared,
    Bounced,
}

/// One row of the receipt → invoice allocation table.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceApplication {
    pub invoice_id: ObjectId,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentReceipt {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- doc number + dates ------------------------------------ */
    pub receipt_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,

    /* ----- parties + accounts ------------------------------------ */
    pub client_id: ObjectId,
    pub mode: PaymentMode,
    /// FK into `crm_payment_accounts` (the bank/UPI/wallet account the
    /// money was received into). Required because every receipt must
    /// debit a real account in the chart of accounts.
    pub bank_account_id: ObjectId,

    /* ----- mode-specific details --------------------------------- */
    /// Populated for `Cheque` mode.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cheque_no: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub cheque_date: Option<DateTime<Utc>>,
    /// UPI/NEFT/RTGS/IMPS/card transaction id.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub txn_id: Option<String>,
    /// Optional human reference ("Goa retreat advance", customer's
    /// internal ref, …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,

    /* ----- amounts ----------------------------------------------- */
    pub amount: f64,
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,

    /* ----- allocation -------------------------------------------- */
    /// Per-invoice allocation. Sum may be less than `amount` when
    /// `excess_as_advance` is `true` — the difference becomes a
    /// customer-advance ledger entry.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub apply_to: Vec<InvoiceApplication>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub excess_as_advance: bool,

    /* ----- adjustments ------------------------------------------- */
    /// TDS deducted by the customer at source. Reduces the AR ledger
    /// by this amount; offset by the TDS receivable account.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_deducted: Option<f64>,
    /// Bank charges (wire fees, processor fees) booked against this
    /// receipt.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_charges: Option<f64>,

    /* ----- doc body ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    /* ----- workflow + lineage ------------------------------------ */
    #[serde(default)]
    pub status: ReceiptStatus,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}

fn is_false(b: &bool) -> bool {
    !*b
}
