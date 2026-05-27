//! §1.6 Invoices.
//!
//! The largest sales doc — adds GST e-invoice (IRN + signed QR + ack
//! no./date), payment-state fields (`amount_paid` / `balance`), TCS/TDS,
//! recurring config, and bank-detail/UPI-QR rendering hints.
//!
//! Mongo collection: `crm_invoices`.

use crate::address::Address;
use crate::comm_log::{EmailLog, PdfStatus, WhatsAppSendLog};
use crate::line_item::{LineItem, Totals};
use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Attribution, Audit, Identity, LineageRef};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InvoiceStatus {
    #[default]
    Draft,
    Sent,
    Paid,
    PartiallyPaid,
    Overdue,
    Cancelled,
}

/// GST treatment for the buyer. Mirrors the dropdown the TS form
/// presents — drives whether CGST+SGST or IGST applies and which
/// e-invoice fields are mandatory.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GstTreatment {
    #[default]
    Registered,
    Composition,
    Unregistered,
    /// Buyer outside India (export). IGST = 0 with bond/LUT, or charged
    /// for non-LUT exports.
    Overseas,
    SezWithPayment,
    SezWithoutPayment,
    DeemedExport,
    Consumer,
}

/// Recurring-invoice cadence. Engine reads `next_run` and creates a new
/// invoice each tick until `end_date` (or never if `None`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecurringFrequency {
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    Yearly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringConfig {
    pub frequency: RecurringFrequency,
    /// Stop after this date. `None` = run forever.
    #[serde(default, with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional", skip_serializing_if = "Option::is_none")]
    pub end_date: Option<DateTime<Utc>>,
    /// Next firing time. Engine advances this on each successful run.
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub next_run: DateTime<Utc>,
    /// Optional cap on number of runs. Decrements per run.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remaining_runs: Option<u32>,
}

/// Banking details printed on the PDF for off-platform settlement.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BankDetails {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_holder: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ifsc: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub swift: Option<String>,
}

/// IRP-issued e-invoice envelope. Populated only after a successful
/// e-invoice registration (B2B GST-registered buyers above the
/// turnover threshold). For B2C / non-applicable invoices, this stays
/// `None` on the parent.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EInvoiceEnvelope {
    /// Invoice Reference Number (64-char hex). Returned by the IRP.
    pub irn: String,
    /// Signed QR string. Embed as a QR code on the PDF.
    pub qr_string: String,
    pub ack_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub ack_date: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Invoice {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub attribution: Attribution,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- system-issued doc number + dates ---------------------- */
    pub invoice_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub due_date: DateTime<Utc>,

    /* ----- parties ----------------------------------------------- */
    pub client_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub place_of_supply: Option<String>,
    /// `true` when the buyer is liable to pay GST under reverse-charge
    /// (e.g. transport / legal services as the buyer).
    #[serde(default, skip_serializing_if = "is_false")]
    pub reverse_charge: bool,
    #[serde(default)]
    pub gst_treatment: GstTreatment,

    /* ----- money settings ---------------------------------------- */
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,

    /* ----- addresses --------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing_address: Option<Address>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shipping_address: Option<Address>,

    /* ----- line items + totals ----------------------------------- */
    /// Line items populate `cess_amount` for products under GST CESS
    /// (luxury cars, tobacco, aerated drinks, …); also CGST/SGST or IGST
    /// per the buyer's place of supply.
    pub items: Vec<LineItem>,
    pub totals: Totals,

    /* ----- TCS / TDS / round-off --------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tcs_pct: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_pct: Option<f32>,

    /* ----- payment state (system-managed) ------------------------ */
    /// Sum of `paymentReceipts` allocated to this invoice. Maintained
    /// by `applyPaymentReceipt` server actions; never user-edited.
    #[serde(default)]
    pub amount_paid: f64,
    /// `totals.total - amount_paid`. Stored (denormalized) so list
    /// queries can sort/filter on outstanding without a per-row join.
    #[serde(default)]
    pub balance: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_terms: Option<String>,

    /* ----- payment hints printed on PDF -------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_details: Option<BankDetails>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upi_id: Option<String>,
    /// FK into `sabfiles` for the rendered UPI QR image (cached so
    /// PDF regen doesn't re-call the QR generator).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qr_image_file_id: Option<ObjectId>,

    /* ----- doc body ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms_and_conditions: Option<String>,

    /* ----- e-invoice + e-way bill cross-refs --------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub e_invoice: Option<EInvoiceEnvelope>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub eway_bill_no: Option<String>,

    /* ----- attachments + render + comm logs ---------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signature_image_file_id: Option<ObjectId>,
    #[serde(default)]
    pub pdf_status: PdfStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design_metadata: Option<bson::Document>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub email_log: Vec<EmailLog>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub whatsapp_send_log: Vec<WhatsAppSendLog>,

    /* ----- recurring + workflow + lineage ------------------------ */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurring: Option<RecurringConfig>,
    #[serde(default)]
    pub status: InvoiceStatus,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}

fn is_false(b: &bool) -> bool {
    !*b
}
