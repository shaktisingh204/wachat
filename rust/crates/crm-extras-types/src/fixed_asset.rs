//! §12.13 Fixed Assets.
//!
//! Mongo collection: `crm_fixed_assets`. A fixed asset is a long-lived
//! tangible resource the business depreciates over its useful life.
//! The struct flattens the `crm-core` cross-cutting fragments
//! (`Identity`, `Audit`) so the document root carries the §0 ownership
//! and audit fields directly.
//!
//! Spec verbatim: Asset code, name, category, purchase date, supplier,
//! cost, useful life, depreciation method (SLM/WDV/units), residual
//! value, location, custodian, condition, warranty, insurance, AMC,
//! retire/sell entry, accumulated depreciation [computed], NBV
//! [computed].

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Depreciation method applied to the asset. `Slm` = Straight Line,
/// `Wdv` = Written Down Value (declining balance), `Units` = units of
/// production (depreciation tracks usage instead of time).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DepreciationMethod {
    #[default]
    Slm,
    Wdv,
    Units,
}

/// Physical condition of the asset. Captured at acquisition and updated
/// during periodic verification rounds. `Retired` is the terminal state
/// once the asset is taken out of service.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AssetCondition {
    #[default]
    New,
    Good,
    Fair,
    Damaged,
    Retired,
}

/// Records the moment the asset leaves the books — either retired
/// (scrapped, no proceeds) or sold to a buyer for `sale_amount`.
/// `mode` is "retire" or "sell".
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetireSellEntry {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    /// Either `"retire"` or `"sell"`. Free-form so accountants can
    /// extend with project-specific dispositions (e.g. `"donate"`)
    /// without a schema migration.
    pub mode: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sale_amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buyer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixedAsset {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- identity / classification ----------------------------- */
    /// Human-readable code (e.g. `LAP-2026-014`). Unique per project by
    /// convention, enforced at the server-action layer.
    pub code: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    /* ----- acquisition ------------------------------------------- */
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub purchase_date: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub supplier_id: Option<ObjectId>,
    pub cost: f64,
    pub currency: String,

    /* ----- depreciation ------------------------------------------ */
    /// Useful life expressed in months — matches the `Number` shape used
    /// by the existing TS schema.
    pub useful_life_months: u32,
    #[serde(default)]
    pub depreciation_method: DepreciationMethod,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub residual_value: Option<f64>,

    /* ----- placement / custody ----------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custodian_employee_id: Option<ObjectId>,
    #[serde(default)]
    pub condition: AssetCondition,

    /* ----- contracts --------------------------------------------- */
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub warranty_until: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub insurance_until: Option<DateTime<Utc>>,
    /// FK into the §12.18 service-contracts collection covering the
    /// asset's annual maintenance contract.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amc_contract_id: Option<ObjectId>,

    /* ----- disposition ------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub retire_or_sell: Option<RetireSellEntry>,

    /* ----- computed running totals ------------------------------- */
    /// [computed] Sum of all depreciation entries posted to date.
    /// Server-side only; clients should treat as read-only.
    #[serde(default)]
    pub accumulated_depreciation: f64,
    /// [computed] Net Book Value = `cost - accumulated_depreciation`.
    /// Server-side only; clients should treat as read-only.
    #[serde(default)]
    pub net_book_value: f64,
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
    fn fixed_asset_round_trips_with_flattened_fragments() {
        let asset = FixedAsset {
            identity: identity(),
            audit: audit(),
            code: "LAP-2026-014".to_string(),
            name: "ThinkPad X1 Carbon".to_string(),
            category: Some("IT Equipment".to_string()),
            purchase_date: Utc::now(),
            supplier_id: Some(ObjectId::new()),
            cost: 145000.0,
            currency: "INR".to_string(),
            useful_life_months: 48,
            depreciation_method: DepreciationMethod::Wdv,
            residual_value: Some(10000.0),
            location: Some("HQ — 4th floor".to_string()),
            custodian_employee_id: Some(ObjectId::new()),
            condition: AssetCondition::Good,
            warranty_until: Some(Utc::now()),
            insurance_until: None,
            amc_contract_id: None,
            retire_or_sell: None,
            accumulated_depreciation: 0.0,
            net_book_value: 145000.0,
        };

        let json = serde_json::to_value(&asset).unwrap();

        // Flattened crm-core fragments at the document root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        // No nested fragment keys.
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        // Entity-specific camelCase fields.
        assert!(json.get("usefulLifeMonths").is_some());
        assert!(json.get("depreciationMethod").is_some());
        assert!(json.get("netBookValue").is_some());
        // Enums lowercased.
        assert_eq!(json.get("depreciationMethod").unwrap(), "wdv");
        assert_eq!(json.get("condition").unwrap(), "good");

        let back: FixedAsset = serde_json::from_value(json).unwrap();
        assert_eq!(back.code, "LAP-2026-014");
        assert!(matches!(back.depreciation_method, DepreciationMethod::Wdv));
        assert!(matches!(back.condition, AssetCondition::Good));
        assert_eq!(back.useful_life_months, 48);
    }
}
