//! §2.2 Purchase Orders.
//!
//! Mongo collection: `crm_purchase_orders`. Approval workflow is a
//! single-step (request → approve) shape today; multi-step approval is
//! tracked in §12.22 and would extend `ApprovalWorkflow` into a vec.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, Identity, LineageRef};
use crm_sales_types::{Address, LineItem, Totals};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PurchaseOrderStatus {
    #[default]
    Draft,
    AwaitingApproval,
    Approved,
    Sent,
    /// Some lines received, others outstanding.
    Partial,
    Received,
    Closed,
    Cancelled,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalWorkflow {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requested_by: Option<ObjectId>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub requested_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_by: Option<ObjectId>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub approved_at: Option<DateTime<Utc>>,
    /// Free-text approver comment (rejection note, conditional
    /// approval rider, …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseOrder {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- doc number + dates ------------------------------------ */
    pub po_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expected_delivery: Option<DateTime<Utc>>,

    /* ----- parties + locations ----------------------------------- */
    pub vendor_id: ObjectId,
    /// Receiving warehouse — required so GRN reconciliation knows
    /// where to land stock.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ship_to_warehouse_id: Option<ObjectId>,
    /// Multi-branch tenants pick the billing entity here.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing_branch_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shipping_address: Option<Address>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_terms: Option<String>,

    /* ----- money settings ---------------------------------------- */
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,

    /* ----- line items + totals ----------------------------------- */
    /// Reuses sales `LineItem` — same item / HSN / qty / rate / tax
    /// shape; warehouse_id / qty_pending populate when receipts come
    /// in.
    pub items: Vec<LineItem>,
    pub totals: Totals,

    /* ----- doc body ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms_and_conditions: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    /* ----- approval --------------------------------------------- */
    #[serde(default)]
    pub approval: ApprovalWorkflow,

    /* ----- workflow + downstream links --------------------------- */
    #[serde(default)]
    pub status: PurchaseOrderStatus,
    /// GRN ids generated from this PO.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub linked_grn_ids: Vec<ObjectId>,
    /// Bills generated from this PO. Multiple is normal — staggered
    /// receipts ⇒ one bill per GRN.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub linked_bill_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}
