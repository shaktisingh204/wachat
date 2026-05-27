//! §1.2 Quotations / Estimates.
//!
//! Mongo collection: `crm_quotations` (matches the existing TS shape in
//! `src/lib/definitions.ts::CrmQuotation`). The struct flattens the
//! `crm-core` cross-cutting fragments (`Identity`, `Audit`,
//! `Attribution`, `Assignment`) so the document root carries the §0
//! ownership / audit / attribution fields directly.

use crate::address::Address;
use crate::comm_log::{EmailLog, PdfStatus, WhatsAppSendLog};
use crate::line_item::{LineItem, Totals};
use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Attribution, Audit, Identity, LineageRef};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QuotationStatus {
    #[default]
    Draft,
    Sent,
    Accepted,
    Rejected,
    Expired,
    Converted,
}

/// Snapshot of a previous version of the quotation. Captured whenever
/// a sent quotation is edited so customers can request the "v2" / "v3"
/// PDF if their internal approval was on an earlier version.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotationRevision {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub revised_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revised_by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    /// Free-form snapshot of the previous doc. Stored as JSON so we
    /// don't recursively pin the entire `Quotation` shape (and so the
    /// schema can evolve without breaking older revisions).
    pub snapshot: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Quotation {
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
    pub quotation_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub valid_until: DateTime<Utc>,

    /* ----- parties ----------------------------------------------- */
    pub client_id: ObjectId,
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
    /// FK into the project's templates collection. Drives the PDF
    /// layout the doc renders with.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_file_id: Option<ObjectId>,
    #[serde(default)]
    pub pdf_status: PdfStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design_metadata: Option<bson::Document>,

    /* ----- comm logs --------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub email_log: Vec<EmailLog>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub whatsapp_send_log: Vec<WhatsAppSendLog>,

    /* ----- workflow + lineage ------------------------------------ */
    #[serde(default)]
    pub status: QuotationStatus,
    /// Forward references created when the quotation is converted to a
    /// downstream document (Sales Order / Invoice). Mirrors `Lineage`
    /// in §13.5 — provenance flows in both directions but the SO/Invoice
    /// itself ALSO writes a backward `lineage` pointing at this id.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub converted_to: Vec<LineageRef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub revision_history: Vec<QuotationRevision>,
}
