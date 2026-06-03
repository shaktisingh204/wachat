//! §1.3 Proforma Invoices.
//!
//! Per the spec ("Same shape as Quotation + Proforma no., Linked SO,
//! Advance %, Advance amount, Expected delivery, Payment due date,
//! Status (draft/sent/paid/converted)") this document is essentially a
//! quotation with payment-related extras.
//!
//! We don't subclass `Quotation` (Rust has no struct inheritance and
//! `#[serde(flatten)]` of a sibling would re-flatten its `Identity` /
//! `Audit` etc. — fine, but it makes the type harder to construct
//! without writing the inner `Quotation` first). Instead, we define the
//! shared fields inline; field-level drift between the two should be
//! rare enough that the duplication is cheaper than the indirection.
//!
//! Mongo collection: `crm_proforma_invoices`.

use crate::address::Address;
use crate::comm_log::{EmailLog, PdfStatus, WhatsAppSendLog};
use crate::line_item::{LineItem, Totals};
use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Attribution, Audit, Identity, LineageRef};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProformaStatus {
    #[default]
    Draft,
    Sent,
    Paid,
    Converted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProformaInvoice {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub attribution: Attribution,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- doc number + dates ------------------------------------ */
    pub proforma_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub valid_until: DateTime<Utc>,

    /* ----- parties + refs ---------------------------------------- */
    pub client_id: ObjectId,
    /// Linked Sales Order. Populated when the proforma is generated as
    /// an advance-payment request against a confirmed SO.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_so_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sales_agent_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deal_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,

    /* ----- money settings ---------------------------------------- */
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub place_of_supply: Option<String>,

    /* ----- addresses --------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing_address: Option<Address>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shipping_address: Option<Address>,

    /* ----- line items + totals ----------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<LineItem>,
    pub totals: Totals,

    /* ----- proforma-specific (advance handling) ------------------ */
    /// Advance %. When populated, drives the ask amount; the absolute
    /// `advance_amount` is computed from it but stored alongside so
    /// PDFs render the exact figure.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advance_pct: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advance_amount: Option<f64>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expected_delivery: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub payment_due_date: Option<DateTime<Utc>>,

    /* ----- doc body ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms_and_conditions: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_notes: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    /* ----- render + branding ------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signature_image_file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_file_id: Option<ObjectId>,
    #[serde(default)]
    pub pdf_status: PdfStatus,

    /* ----- comm logs --------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub email_log: Vec<EmailLog>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub whatsapp_send_log: Vec<WhatsAppSendLog>,

    /* ----- workflow + lineage ------------------------------------ */
    #[serde(default)]
    pub status: ProformaStatus,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub converted_to: Vec<LineageRef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}
