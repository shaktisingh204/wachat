//! §3.3 Stock Adjustments.
//!
//! Mongo collection: `crm_stock_adjustments`. A stock adjustment captures
//! a reconciliation entry against a warehouse — damage, theft, correction,
//! found stock, or transfer in / out — and records the per-line
//! qty-before / qty-after deltas plus an optional cost so the document
//! can compute its own ledger impact.
//!
//! Cross-cutting `crm-core` fragments (`Identity`, `Audit`, `Assignment`)
//! are flattened so the document root carries the §0 ownership / audit
//! / assignment fields directly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, Identity};
use serde::{Deserialize, Serialize};

/// Reason a stock adjustment was raised.
///
/// Single-token variants (`damage`, `theft`, `correction`, `found`) are
/// stored lowercase by virtue of the snake_case rule collapsing on a
/// single word; the multi-word transfer variants serialize to
/// `transfer_in` / `transfer_out`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StockAdjustmentReason {
    #[default]
    Correction,
    Damage,
    Theft,
    Found,
    TransferIn,
    TransferOut,
}

/// One line on a stock adjustment.
///
/// `qty_before` / `qty_after` are absolute on-hand snapshots — the delta
/// (and therefore the ledger impact) is `(qty_after - qty_before) * cost`.
/// `batch` and `serial_no` narrow the adjustment when the item is tracked
/// by lot or serial; `cost` is optional because correction-style entries
/// for non-valued stock don't move the books.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockAdjustmentLine {
    /// FK into `crm_items`.
    pub item_id: ObjectId,

    pub qty_before: f64,
    pub qty_after: f64,

    /// Batch / lot number when the item is batch-tracked.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch: Option<String>,

    /// Serial number when the item is serial-tracked.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub serial_no: Option<String>,

    /// Per-unit cost used to value the delta. Optional — non-valued
    /// corrections (e.g. miscount on consumables) leave this `None`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cost: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockAdjustment {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- system-issued doc number + dates ---------------------- */
    /// System-generated adjustment number (e.g. `ADJ-2026-00042`).
    pub adjustment_no: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,

    /* ----- scope ------------------------------------------------- */
    /// FK into `crm_warehouses` — the warehouse this adjustment moves
    /// stock against.
    pub warehouse_id: ObjectId,
    pub reason: StockAdjustmentReason,

    /// Free-form pointer at the source paperwork — could be a PO ref,
    /// GRN ref, transfer note, police FIR for theft, etc. We keep this
    /// as a string (rather than an ObjectId) because cross-document
    /// lineage can target documents we don't yet have a typed shape for.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference_doc: Option<String>,

    /* ----- body -------------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<StockAdjustmentLine>,

    /// Pre-computed sum of `(qty_after - qty_before) * cost` across
    /// lines. Stored on the doc so listings don't have to re-aggregate.
    #[serde(default)]
    pub total_impact: f64,

    /* ----- approval + body --------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /* ----- attachments ------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn sample_adjustment() -> StockAdjustment {
        StockAdjustment {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            assignment: Assignment::default(),
            adjustment_no: "ADJ-2026-00042".into(),
            date: Utc::now(),
            warehouse_id: ObjectId::new(),
            reason: StockAdjustmentReason::TransferOut,
            reference_doc: Some("TRF-NOTE-7711".into()),
            items: vec![StockAdjustmentLine {
                item_id: ObjectId::new(),
                qty_before: 50.0,
                qty_after: 48.0,
                batch: Some("LOT-A19".into()),
                serial_no: None,
                cost: Some(120.0),
            }],
            total_impact: -240.0,
            approved_by: Some(ObjectId::new()),
            notes: Some("Two units moved to Warehouse-B via TRF-NOTE-7711.".into()),
            attachments: vec![],
        }
    }

    #[test]
    fn round_trips_with_flattened_fragments() {
        let a = sample_adjustment();
        let json = serde_json::to_value(&a).unwrap();

        // crm-core::Identity flattens to root.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());

        // crm-core::Audit flattens to root.
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // camelCase entity fields appear at root.
        assert!(json.get("adjustmentNo").is_some());
        assert!(json.get("warehouseId").is_some());
        assert!(json.get("referenceDoc").is_some());
        assert!(json.get("totalImpact").is_some());
        assert!(json.get("approvedBy").is_some());

        // multi-word enum variant serializes snake_case.
        assert_eq!(
            json.get("reason").and_then(|v| v.as_str()),
            Some("transfer_out")
        );

        // line-item fields camelCase.
        let line0 = &json.get("items").unwrap().as_array().unwrap()[0];
        assert!(line0.get("itemId").is_some());
        assert!(line0.get("qtyBefore").is_some());
        assert!(line0.get("qtyAfter").is_some());
        assert!(
            line0.get("serialNo").is_none(),
            "None should skip-serialize"
        );

        // round-trip through serde_json.
        let back: StockAdjustment = serde_json::from_value(json).unwrap();
        assert_eq!(back.adjustment_no, a.adjustment_no);
        assert_eq!(back.reason, StockAdjustmentReason::TransferOut);
        assert_eq!(back.items.len(), 1);
        assert_eq!(back.total_impact, -240.0);
    }

    #[test]
    fn single_word_reason_is_lowercase() {
        let json = serde_json::to_string(&StockAdjustmentReason::Damage).unwrap();
        assert_eq!(json, "\"damage\"");
        let json = serde_json::to_string(&StockAdjustmentReason::Found).unwrap();
        assert_eq!(json, "\"found\"");
    }
}
