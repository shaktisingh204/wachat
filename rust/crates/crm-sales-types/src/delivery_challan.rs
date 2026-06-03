//! §1.5 Delivery Challans.
//!
//! Mongo collection: `crm_delivery_challans`. Unlike value-bearing docs,
//! the line items here track physical-goods movement (qty + batch +
//! expiry + serial numbers) rather than pricing — so we use a dedicated
//! `ChallanLineItem` instead of the shared `LineItem`.

use crate::address::Address;
use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, Identity, LineageRef};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DeliveryChallanStatus {
    #[default]
    Draft,
    Dispatched,
    Delivered,
    /// Customer rejected goods — stock returned.
    Returned,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModeOfTransport {
    #[default]
    Road,
    Rail,
    Air,
    Ship,
}

/// Reason codes printed on the GST-mandated delivery challan body.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChallanReason {
    #[default]
    Sale,
    JobWork,
    SupplyOnApproval,
    LiquidGas,
    OwnUse,
    BranchTransfer,
    Other,
}

/// Physical-goods line item. No pricing — just the movement details
/// regulators expect on a delivery challan.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChallanLineItem {
    /// FK into `crm_products`.
    pub item_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub qty: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    /// Manufacturing batch / lot number — required for FMCG, pharma,
    /// food where traceability is regulated.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expiry: Option<DateTime<Utc>>,
    /// Per-piece serial numbers when the item is serialized
    /// (electronics, machinery, vehicles).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub serial_nos: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryChallan {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- doc number + dates ------------------------------------ */
    pub challan_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,

    /* ----- refs + parties ---------------------------------------- */
    /// Source Sales Order. Optional — non-SO challans are issued for
    /// stock transfers / job-work returns.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub so_ref: Option<ObjectId>,
    pub client_id: ObjectId,

    /* ----- transport details ------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vehicle_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub driver_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub driver_phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transporter: Option<String>,
    /// Lorry-receipt number issued by the transporter.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lr_no: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub lr_date: Option<DateTime<Utc>>,
    #[serde(default)]
    pub mode_of_transport: ModeOfTransport,
    /// E-way bill number (GST-mandated for goods movements above the
    /// state threshold). Stored as the printed string, not split apart.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub eway_bill_no: Option<String>,

    /* ----- goods + locations ------------------------------------- */
    pub items: Vec<ChallanLineItem>,
    /// Originating warehouse — required for stock-decrement at dispatch.
    pub dispatch_warehouse_id: ObjectId,
    pub ship_to_address: Address,
    #[serde(default)]
    pub reason_for_transport: ChallanReason,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason_note: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    /* ----- workflow + lineage ------------------------------------ */
    #[serde(default)]
    pub status: DeliveryChallanStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design_metadata: Option<bson::Document>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}
