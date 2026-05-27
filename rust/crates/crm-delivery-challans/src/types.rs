//! On-disk shape of a `crm_delivery_challans` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use crm_core::LineageRef;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChallanLineItem {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_id: Option<ObjectId>,
    pub description: String,
    pub quantity: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hsn_code: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TransportDetails {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vehicle_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub driver_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmDeliveryChallan {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub challan_number: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_id: Option<ObjectId>,
    pub challan_date: BsonDateTime,

    #[serde(default)]
    pub line_items: Vec<ChallanLineItem>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default)]
    pub transport_details: TransportDetails,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `"Draft"` | `"Issued"` | `"Delivered"` | `"Cancelled"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    /// §13.5 lineage chain — `[Lead, Deal, Quotation, SalesOrder, …]`
    /// inherited from the parent at convert time. Empty on freestanding
    /// challans (created without a `fromKind`/`fromId`).
    #[serde(default)]
    pub lineage: Vec<LineageRef>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,

    /// Optional PDF designer payload — mirrors the field added to the
    /// canonical `crm-sales-types::DeliveryChallan` so the handlers can
    /// pass-through what the UI sends without losing layout state.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design_metadata: Option<bson::Document>,
}
