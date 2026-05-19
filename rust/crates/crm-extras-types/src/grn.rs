//! §12.4 GRN / GIN / MRN.
//!
//! Mongo collection: `crm_grns`. Goods Receipt Note — the record posted
//! when stock physically lands at the receiving warehouse against a
//! purchase order. The GIN (Goods Issue Note) and MRN (Material
//! Returns Note) counterpart documents live in their own collections;
//! `gin_id` / `mrn_id` here are forward links so the GRN screen can
//! surface "issued / returned against this receipt" in one round-trip.
//!
//! The struct flattens the `crm-core` cross-cutting fragments
//! (`Identity`, `Audit`) so the document root carries the §0 ownership
//! and audit fields directly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Attachment, Audit, Identity, LineageRef};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GrnStatus {
    #[default]
    Draft,
    /// Stock received at warehouse, awaiting inspection.
    Received,
    /// Partially received (split shipment).
    Partial,
    /// Inspection complete and approved.
    Inspected,
    /// Quality check failed on one or more lines.
    QcFailed,
    /// Accepted quantities posted to inventory ledger.
    Posted,
    /// GRN fully settled — stock in, returns raised, no pending actions.
    Closed,
    Rejected,
}

/// One received-line row on a GRN. `received_qty = accepted_qty +
/// rejected_qty` is enforced at the server-action layer, not at the
/// type level. `serial_nos` is populated only for serialized SKUs;
/// `batch` + `expiry` only for batch-tracked SKUs.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrnLineItem {
    pub item_id: ObjectId,
    pub ordered_qty: f64,
    pub received_qty: f64,
    pub accepted_qty: f64,
    pub rejected_qty: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch: Option<String>,
    #[serde(default, with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional", skip_serializing_if = "Option::is_none")]
    pub expiry: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub serial_nos: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Grn {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- doc number + dates ----------------------------------- */
    pub grn_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,

    /* ----- references ------------------------------------------- */
    /// Originating PO. Optional because direct receipts (no PO) are
    /// allowed for unplanned vendor deliveries.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub po_id: Option<ObjectId>,
    pub vendor_id: ObjectId,
    pub warehouse_id: ObjectId,

    /* ----- received lines --------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<GrnLineItem>,

    /* ----- inspection ------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inspector_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    /* ----- workflow + counterparts ------------------------------ */
    #[serde(default)]
    pub status: GrnStatus,

    /// Forward link to the GIN (Goods Issue Note) raised from this
    /// receipt — populated when accepted stock is issued out.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gin_id: Option<ObjectId>,
    /// Forward link to the MRN (Material Returns Note) for the
    /// rejected portion — populated when rejected stock is returned to
    /// the vendor.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mrn_id: Option<ObjectId>,

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

    #[test]
    fn grn_round_trips_with_flattened_fragments() {
        let identity = Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        };
        let now = Utc::now();
        let audit = Audit {
            created_at: now,
            updated_at: now,
            created_by: None,
            updated_by: None,
        };

        let grn = Grn {
            identity,
            audit,
            grn_no: "GRN-2026-0001".to_string(),
            date: now,
            po_id: Some(ObjectId::new()),
            vendor_id: ObjectId::new(),
            warehouse_id: ObjectId::new(),
            items: vec![GrnLineItem {
                item_id: ObjectId::new(),
                ordered_qty: 100.0,
                received_qty: 100.0,
                accepted_qty: 95.0,
                rejected_qty: 5.0,
                batch: Some("BATCH-A".to_string()),
                expiry: Some(now),
                serial_nos: vec!["SN-001".to_string(), "SN-002".to_string()],
            }],
            inspector_id: Some(ObjectId::new()),
            attachments: vec![],
            status: GrnStatus::Inspected,
            gin_id: None,
            mrn_id: None,
            lineage: vec![],
        };

        let json = serde_json::to_value(&grn).unwrap();

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
        assert!(json.get("grnNo").is_some());
        assert!(json.get("poId").is_some());
        assert!(json.get("vendorId").is_some());
        assert!(json.get("warehouseId").is_some());
        assert!(json.get("inspectorId").is_some());
        // Status serializes lowercase.
        assert_eq!(json.get("status").unwrap(), "inspected");
        // Optional None counterparts skip-serialize.
        assert!(json.get("ginId").is_none());
        assert!(json.get("mrnId").is_none());

        // Per-line camelCase.
        let line0 = &json.get("items").unwrap()[0];
        assert!(line0.get("orderedQty").is_some());
        assert!(line0.get("receivedQty").is_some());
        assert!(line0.get("acceptedQty").is_some());
        assert!(line0.get("rejectedQty").is_some());
        assert!(line0.get("serialNos").is_some());

        let back: Grn = serde_json::from_value(json).unwrap();
        assert_eq!(back.grn_no, "GRN-2026-0001");
        assert!(matches!(back.status, GrnStatus::Inspected));
        assert_eq!(back.items.len(), 1);
        assert_eq!(back.items[0].serial_nos.len(), 2);
    }
}
