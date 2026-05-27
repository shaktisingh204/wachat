//! §1.8 Credit Notes.
//!
//! Mongo collection: `crm_credit_notes`. A credit note is the inverse
//! of an invoice — issued for returns / discounts / price adjustments /
//! cancellations. Tax recalculation and IRP reporting follow the linked
//! invoice's GST treatment.

use crate::line_item::{LineItem, Totals};
use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, Identity, LineageRef};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CreditNoteReason {
    Return,
    Discount,
    PriceAdjust,
    Cancel,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RefundMode {
    /// Refund paid back as cash / bank transfer.
    Cash,
    /// Held as a credit balance on the customer's ledger; consumed by
    /// future invoices.
    Credit,
    /// Replacement goods/services shipped instead of a refund.
    Replacement,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CreditNoteStatus {
    #[default]
    Draft,
    Issued,
    Refunded,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditNote {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- doc number + dates ------------------------------------ */
    pub cn_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,

    /* ----- parties + refs ---------------------------------------- */
    pub client_id: ObjectId,
    /// Source invoice. Optional — standalone credit notes (issued
    /// without a prior invoice, e.g. goodwill credit) are allowed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_invoice_id: Option<ObjectId>,
    pub reason: CreditNoteReason,

    /* ----- money settings ---------------------------------------- */
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,

    /* ----- line items + totals ----------------------------------- */
    pub items: Vec<LineItem>,
    pub totals: Totals,

    /* ----- recalculation knob ------------------------------------ */
    /// `true` ⇒ recompute taxes from line-item rates rather than
    /// inheriting the source invoice's tax breakdown verbatim. Used
    /// when the credit note is for a partial return at a different
    /// rate, or when GST policy changed between invoice and CN.
    #[serde(default, skip_serializing_if = "is_false")]
    pub tax_recalc: bool,

    /* ----- refund handling --------------------------------------- */
    pub refund_mode: RefundMode,
    /// Bank/UPI txn id when `refund_mode == Cash`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refund_txn_id: Option<String>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub auto_apply: bool,

    /* ----- doc body ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    /* ----- workflow + lineage ------------------------------------ */
    #[serde(default)]
    pub status: CreditNoteStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design_metadata: Option<bson::Document>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}

fn is_false(b: &bool) -> bool {
    !*b
}
