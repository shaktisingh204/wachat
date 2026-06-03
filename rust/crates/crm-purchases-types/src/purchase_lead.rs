//! §2.6 Purchase Leads / Hire & Services.
//!
//! Mongo collection: `crm_purchase_leads`. Sourcing-side pipeline doc
//! tracking RFQ-style demand discovery before a PO is placed.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, Identity, LineageRef};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PurchaseLeadStage {
    #[default]
    Sourcing,
    QuotesReceived,
    Negotiating,
    Awarded,
    ClosedLost,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseLead {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    pub title: String,
    /// Front-runner vendor while the lead is open. Optional because
    /// pure RFQs don't pre-pick a candidate.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_candidate_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub required_by: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quantity: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub estimated_budget: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    /// Detailed specifications. Free text (markdown / plain).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub specs: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    #[serde(default)]
    pub stage: PurchaseLeadStage,

    /// Vendor that won the bid, populated when `stage == Awarded`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub awarded_vendor_id: Option<ObjectId>,
    /// PO ids generated when the lead converted into a purchase.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub linked_po_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}
