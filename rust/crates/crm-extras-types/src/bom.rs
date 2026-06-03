//! §12.5 BOM / Manufacturing.
//!
//! Mongo collections: `crm_boms` + `crm_production_orders`.
//!
//! A `Bom` defines the recipe for a finished good: its components (with
//! per-line scrap %, optional flag, unit), labour + overhead overlay, the
//! batch output qty, plus a version + effective-date pair so older
//! production orders keep referencing the BOM revision they were planned
//! against. A `ProductionOrder` (job card) realises a BOM against a
//! planned qty, captures actual yield / scrap / downtime, and rolls up
//! cost once `status = completed`.
//!
//! Both structs flatten the §0 `Identity` + `Audit` fragments.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* ============================== BOM ====================================== */

/// Lifecycle of a BOM revision. `Active` is the only status the planner
/// will pick when creating new production orders; older revisions are
/// retained as `Obsolete` for traceability.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BomStatus {
    #[default]
    Draft,
    Active,
    Obsolete,
}

/// A single component line on a BOM. `scrap_pct` widens the planned pull
/// at issue-time (e.g. 5 % wastage on a stamping op); `optional`
/// components are excluded from auto material requisition unless the
/// shop floor explicitly toggles them on.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BomComponent {
    /// FK into `crm_products` (raw material / sub-assembly).
    pub item_id: ObjectId,

    pub qty: f64,

    /// Unit of measure ("nos", "kg", "m", …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,

    /// Scrap % to overlay on top of `qty` when issuing material.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scrap_pct: Option<f32>,

    /// `true` if this component is a substitution / accessory and may be
    /// omitted at issue-time without breaking the build.
    #[serde(default, skip_serializing_if = "is_false")]
    pub optional: bool,
}

/// Bill of Materials document.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bom {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- recipe head ------------------------------------------- */
    /// FK into `crm_products` — the finished good this BOM produces.
    pub finished_good_id: ObjectId,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub components: Vec<BomComponent>,

    /* ----- cost overlays (per output batch) ---------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub labour_cost: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overhead_cost: Option<f64>,

    /// Output qty produced by one execution of this BOM. Used as the
    /// denominator when scaling component qty for a planned production
    /// order qty.
    pub output_qty: f64,

    /* ----- revision metadata ------------------------------------- */
    pub version: u32,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub effective_date: DateTime<Utc>,

    #[serde(default)]
    pub status: BomStatus,
}

/* ========================== PRODUCTION ORDER ============================= */

/// Lifecycle of a production order / job card.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProductionStatus {
    #[default]
    Planned,
    InProgress,
    Completed,
    Cancelled,
}

/// A single downtime event captured against a production order. The
/// shop floor logs these as they happen; cost roll-up consumes them at
/// completion to attribute lost minutes against overhead.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DowntimeReason {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    pub minutes: u32,
    pub reason: String,
}

/// Production Order / Job Card. Realises a `Bom` revision against a
/// planned qty, records actual yield / scrap, and rolls cost up once
/// completed.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionOrder {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- planning --------------------------------------------- */
    /// FK into `crm_boms` — the BOM revision being built.
    pub bom_id: ObjectId,

    pub planned_qty: f64,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub start: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub end: Option<DateTime<Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub machine_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operator_id: Option<ObjectId>,

    /* ----- execution --------------------------------------------- */
    /// Realised good output qty. Populated at completion.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actual_yield: Option<f64>,

    /// Realised scrap qty (in finished-good units).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scrap: Option<f64>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub downtime: Vec<DowntimeReason>,

    /// Total cost rolled up at completion (material + labour + overhead
    /// + downtime attribution). Stays `None` while in progress.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cost_rollup: Option<f64>,

    #[serde(default)]
    pub status: ProductionStatus,
}

/* ========================== helpers ====================================== */

#[allow(clippy::trivially_copy_pass_by_ref)]
fn is_false(b: &bool) -> bool {
    !*b
}

/* ============================== tests ==================================== */

#[cfg(test)]
mod tests {
    use super::*;

    fn ident() -> Identity {
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
    fn bom_round_trips_with_flattened_fragments() {
        let bom = Bom {
            identity: ident(),
            audit: audit(),
            finished_good_id: ObjectId::new(),
            components: vec![BomComponent {
                item_id: ObjectId::new(),
                qty: 2.5,
                unit: Some("kg".into()),
                scrap_pct: Some(5.0),
                optional: false,
            }],
            labour_cost: Some(120.0),
            overhead_cost: None,
            output_qty: 10.0,
            version: 1,
            effective_date: Utc::now(),
            status: BomStatus::Active,
        };

        let json = serde_json::to_value(&bom).unwrap();
        assert!(json.get("_id").is_some(), "_id flattened to root");
        assert!(json.get("projectId").is_some(), "projectId flattened");
        assert!(json.get("userId").is_some(), "userId flattened");
        assert!(json.get("createdAt").is_some(), "createdAt flattened");
        assert!(
            json.get("identity").is_none(),
            "identity must not be a nested key"
        );
        assert!(
            json.get("audit").is_none(),
            "audit must not be a nested key"
        );
        assert!(json.get("finishedGoodId").is_some());
        assert!(json.get("outputQty").is_some());
        assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("active"));

        let back: Bom = serde_json::from_value(json).unwrap();
        assert_eq!(back.version, 1);
        assert_eq!(back.components.len(), 1);
    }

    #[test]
    fn production_order_round_trips_with_flattened_fragments() {
        let order = ProductionOrder {
            identity: ident(),
            audit: audit(),
            bom_id: ObjectId::new(),
            planned_qty: 100.0,
            start: Utc::now(),
            end: None,
            machine_id: None,
            operator_id: None,
            actual_yield: None,
            scrap: None,
            downtime: vec![DowntimeReason {
                at: Utc::now(),
                minutes: 12,
                reason: "tool-change".into(),
            }],
            cost_rollup: None,
            status: ProductionStatus::InProgress,
        };

        let json = serde_json::to_value(&order).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("bomId").is_some());
        assert!(json.get("plannedQty").is_some());
        assert_eq!(
            json.get("status").and_then(|v| v.as_str()),
            Some("in_progress"),
            "multi-word variant must serialize snake_case"
        );

        let back: ProductionOrder = serde_json::from_value(json).unwrap();
        assert_eq!(back.planned_qty, 100.0);
        assert_eq!(back.downtime.len(), 1);
    }
}
