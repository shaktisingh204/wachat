//! §2.4 Debit Notes.
//!
//! Mongo collection: `crm_debit_notes`. Vendor-side mirror of credit
//! notes — issued for returns / discounts / cancellations against a
//! prior bill.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, Identity, LineageRef};
use crm_sales_types::{LineItem, RefundMode, Totals};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DebitNoteReason {
    Return,
    Discount,
    PriceAdjust,
    Cancel,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DebitNoteStatus {
    #[default]
    Draft,
    Issued,
    Refunded,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebitNote {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- doc number + dates ------------------------------------ */
    pub dn_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,

    /* ----- parties + refs ---------------------------------------- */
    pub vendor_id: ObjectId,
    /// Source bill. Optional — standalone debit notes are allowed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_bill_id: Option<ObjectId>,
    pub reason: DebitNoteReason,

    /* ----- money settings ---------------------------------------- */
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,

    /* ----- line items + totals ----------------------------------- */
    pub items: Vec<LineItem>,
    pub totals: Totals,

    /* ----- refund handling --------------------------------------- */
    /// Refund mode reuses the sales `RefundMode` enum (cash / credit /
    /// replacement) — semantics flip ("credit" means we hold credit
    /// against the vendor).
    pub refund_mode: RefundMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refund_txn_id: Option<String>,

    /* ----- doc body --------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    /* ----- workflow + lineage ------------------------------------ */
    #[serde(default)]
    pub status: DebitNoteStatus,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}
