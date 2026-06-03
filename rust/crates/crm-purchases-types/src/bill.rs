//! §2.3 Purchases & Expenses (Bills).
//!
//! Mongo collection: `crm_bills`. A bill can carry either inventory
//! line items (when paying for stock against a PO) or expense lines
//! (when booking a service / utility / rent / etc. against a ledger).
//! Both vectors are present on the same struct so the same DTO covers
//! both flows; conventionally exactly one is non-empty.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, Identity, LineageRef};
use crm_sales_types::{LineItem, RecurringConfig, Totals};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BillStatus {
    #[default]
    Draft,
    Submitted,
    Approved,
    Paid,
    PartiallyPaid,
    Overdue,
    Cancelled,
}

/// Non-inventory expense line. Posts to a ledger account directly
/// without going through the items collection.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseLine {
    /// FK into `crm_chart_of_accounts` — the expense ledger this line
    /// debits.
    pub account_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub amount: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_rate_pct: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cgst_amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sgst_amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub igst_amount: Option<f64>,
    /// Optional FK into `crm_projects` when the expense is billable to
    /// a project.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bill {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- doc numbers + dates ----------------------------------- */
    /// Internal bill number we generate.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bill_no: Option<String>,
    /// Vendor's invoice number printed on their original document.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_invoice_no: Option<String>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub bill_date: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub due_date: Option<DateTime<Utc>>,

    /* ----- parties ----------------------------------------------- */
    pub vendor_id: ObjectId,

    /* ----- body (one or both vectors populated) ------------------ */
    /// Inventory-line items. Populated when the bill is against goods.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<LineItem>,
    /// Direct-to-ledger expense lines. Populated for service / utility
    /// / rent / overhead bills.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub expense_lines: Vec<ExpenseLine>,

    /* ----- TDS + reverse-charge --------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_section: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_amount: Option<f64>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub reverse_charge: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub place_of_supply: Option<String>,

    /* ----- money settings + totals ------------------------------- */
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,
    pub totals: Totals,

    /* ----- payment state (system-managed) ------------------------ */
    #[serde(default)]
    pub amount_paid: f64,
    #[serde(default)]
    pub balance: f64,

    /* ----- recurring -------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurring: Option<RecurringConfig>,

    /* ----- attachments + notes ----------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /* ----- workflow + cross-refs --------------------------------- */
    #[serde(default)]
    pub status: BillStatus,
    /// Linked PO if any.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_po_id: Option<ObjectId>,
    /// Linked GRN(s) if any.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub linked_grn_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}

fn is_false(b: &bool) -> bool {
    !*b
}
