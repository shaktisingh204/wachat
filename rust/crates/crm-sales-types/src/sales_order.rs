//! §1.4 Sales Orders.
//!
//! Mongo collection: `crm_sales_orders`. Line items here populate the
//! optional fulfillment fields on the shared `LineItem` (`warehouse_id`,
//! `qty_pending`, `qty_delivered`, `qty_invoiced`) — those four are
//! always-`None` on quotation/proforma/invoice.

use crate::address::Address;
use crate::line_item::{LineItem, Totals};
use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Attribution, Audit, Identity, LineageRef};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SalesOrderStatus {
    #[default]
    Open,
    /// Some lines fulfilled, others outstanding.
    Partial,
    Fulfilled,
    /// Closed without full fulfillment (short-supply / customer waived).
    Closed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryMethod {
    Courier,
    Transporter,
    InHouse,
    Pickup,
    Digital,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesOrder {
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
    pub so_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,

    /* ----- parties + refs ---------------------------------------- */
    pub client_id: ObjectId,
    /// Source quotation, when this SO was converted from one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quotation_ref: Option<ObjectId>,
    /// Customer-side PO number (their internal ref).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub po_no: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub po_date: Option<DateTime<Utc>>,

    /* ----- delivery ---------------------------------------------- */
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expected_shipment_date: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delivery_method: Option<DeliveryMethod>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_terms: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shipping_address: Option<Address>,

    /* ----- money settings ---------------------------------------- */
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,

    /* ----- line items + totals ----------------------------------- */
    /// Line items carry the SO-only fulfillment quartet
    /// (`warehouse_id` / `qty_pending` / `qty_delivered` /
    /// `qty_invoiced`) — see [`LineItem`].
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<LineItem>,
    pub totals: Totals,

    /* ----- doc body ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub internal_notes: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    /* ----- workflow + downstream links --------------------------- */
    #[serde(default)]
    pub status: SalesOrderStatus,
    /// Delivery-challan ids generated from this SO.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub linked_delivery_ids: Vec<ObjectId>,
    /// Invoice ids generated from this SO. Multiple is normal —
    /// staggered fulfillment ⇒ one invoice per delivery.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub linked_invoice_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design_metadata: Option<bson::Document>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}
