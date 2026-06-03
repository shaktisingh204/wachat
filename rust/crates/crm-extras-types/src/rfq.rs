//! §12.3 RFQ / Vendor Bid.
//!
//! Two top-level entities live in this module:
//! - `Rfq` (Mongo collection `crm_rfqs`) — the request a buyer broadcasts
//!   to a list of invited vendors with the items, deadline and terms.
//! - `VendorBid` (Mongo collection `crm_vendor_bids`) — a single vendor's
//!   priced response against an `Rfq`.
//!
//! Each struct flattens the `crm-core` cross-cutting fragments
//! (`Identity`, `Audit`) so the document root carries the §0 ownership
//! and audit fields directly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Attachment, Audit, Identity, LineageRef};
use crm_sales_types::Totals;
use serde::{Deserialize, Serialize};

/* ============================================================== */
/*  RFQ                                                            */
/* ============================================================== */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RfqStatus {
    #[default]
    Draft,
    Open,
    Closed,
    Awarded,
    Cancelled,
}

/// One requested-item row on an RFQ. Free-text `description` and `specs`
/// let buyers float ad-hoc requirements that may not yet exist in the
/// catalog.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RfqLineItem {
    pub item_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub qty: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub specs: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rfq {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- header ----------------------------------------------- */
    pub title: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<RfqLineItem>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub required_by: Option<DateTime<Utc>>,

    /// Vendors broadcast on issue. New invitees can be appended while
    /// the RFQ is still `open`; closing freezes the list.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub vendors_invited: Vec<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub deadline: Option<DateTime<Utc>>,

    #[serde(default)]
    pub status: RfqStatus,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    /// Forward / backward references — e.g. when an `awarded` RFQ
    /// converts into a Purchase Order, the resulting PO id lands here.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}

/* ============================================================== */
/*  Vendor Bid                                                     */
/* ============================================================== */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BidStatus {
    #[default]
    Submitted,
    Shortlisted,
    Awarded,
    Rejected,
    Withdrawn,
}

/// One priced row inside a `VendorBid`. `lead_time_days` is captured
/// per-line because vendors often quote a faster lead time on stocked
/// SKUs and a slower one on made-to-order items.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidLineItem {
    pub item_id: ObjectId,
    pub qty: f64,
    pub rate: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lead_time_days: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VendorBid {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- references ------------------------------------------- */
    pub rfq_id: ObjectId,
    pub vendor_id: ObjectId,

    /* ----- priced response -------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<BidLineItem>,
    pub totals: Totals,
    pub currency: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    #[serde(default)]
    pub status: BidStatus,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub submitted_at: DateTime<Utc>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lineage: Vec<LineageRef>,
}

/* ============================================================== */
/*  Tests                                                          */
/* ============================================================== */

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn audit() -> Audit {
        let now = Utc::now();
        Audit {
            created_at: now,
            updated_at: now,
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn rfq_round_trips_with_flattened_fragments() {
        let rfq = Rfq {
            identity: identity(),
            audit: audit(),
            title: "Q3 stationery sourcing".to_string(),
            items: vec![RfqLineItem {
                item_id: ObjectId::new(),
                description: Some("A4 80gsm ream".to_string()),
                qty: 100.0,
                unit: Some("box".to_string()),
                specs: Some("FSC certified".to_string()),
            }],
            required_by: Some(Utc::now()),
            vendors_invited: vec![ObjectId::new(), ObjectId::new()],
            terms: Some("Net-30, FOB warehouse".to_string()),
            deadline: Some(Utc::now()),
            status: RfqStatus::Open,
            attachments: vec![],
            lineage: vec![],
        };

        let json = serde_json::to_value(&rfq).unwrap();

        // Flattened crm-core fragments live at root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        // Nested fragment keys must NOT exist.
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        // Entity-specific camelCase fields.
        assert!(json.get("vendorsInvited").is_some());
        assert!(json.get("requiredBy").is_some());
        // Status serializes lowercase.
        assert_eq!(json.get("status").unwrap(), "open");

        let back: Rfq = serde_json::from_value(json).unwrap();
        assert_eq!(back.title, "Q3 stationery sourcing");
        assert!(matches!(back.status, RfqStatus::Open));
    }

    #[test]
    fn vendor_bid_round_trips_with_flattened_fragments() {
        let bid = VendorBid {
            identity: identity(),
            audit: audit(),
            rfq_id: ObjectId::new(),
            vendor_id: ObjectId::new(),
            items: vec![BidLineItem {
                item_id: ObjectId::new(),
                qty: 100.0,
                rate: 219.5,
                lead_time_days: Some(7),
                notes: None,
            }],
            totals: Totals::default(),
            currency: "INR".to_string(),
            terms: Some("Net-30".to_string()),
            attachments: vec![],
            status: BidStatus::Shortlisted,
            submitted_at: Utc::now(),
            lineage: vec![],
        };

        let json = serde_json::to_value(&bid).unwrap();

        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("rfqId").is_some());
        assert!(json.get("vendorId").is_some());
        assert!(json.get("submittedAt").is_some());
        assert_eq!(json.get("status").unwrap(), "shortlisted");
        assert_eq!(json.get("currency").unwrap(), "INR");

        let back: VendorBid = serde_json::from_value(json).unwrap();
        assert_eq!(back.currency, "INR");
        assert!(matches!(back.status, BidStatus::Shortlisted));
        assert_eq!(back.items.len(), 1);
    }
}
