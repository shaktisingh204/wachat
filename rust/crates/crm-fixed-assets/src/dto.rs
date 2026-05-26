//! Wire-format request DTOs for the §12.13 fixed-asset endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_extras_types::FixedAsset`] — we deliberately do not redeclare
//! it here. The shapes below describe only what callers send IN
//! (create-input, update-input, list-query); they are intentionally
//! narrower than the full FixedAsset model so the API surface stays
//! controlled.
//!
//! All structs use `#[serde(rename_all = "camelCase")]` so JSON
//! requests round-trip with the TS clients.

use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/fixed-assets` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across
/// `code`, `name`, and `location`. The structured filters
/// (`category` / `condition` / `depreciationMethod`) are exact-match —
/// the latter two are validated as enum variants at the handler.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// 1-indexed page (matches TS). Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to
    /// [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text search (case-insensitive substring across `code`,
    /// `name`, and `location`).
    #[serde(default)]
    pub q: Option<String>,
    /// Restrict to a single classification bucket (free-form string —
    /// the §12.13 spec doesn't constrain the category vocabulary).
    #[serde(default)]
    pub category: Option<String>,
    /// Restrict to a single physical condition (`new`, `good`, `fair`,
    /// `damaged`, `retired`).
    #[serde(default)]
    pub condition: Option<String>,
    /// Restrict to a single depreciation method (`slm`, `wdv`,
    /// `units`).
    #[serde(default)]
    pub depreciation_method: Option<String>,
}

/// `POST /v1/crm/fixed-assets` body. The endpoint accepts a curated
/// subset of the full [`crm_extras_types::FixedAsset`] fields — enough
/// to drive the existing "Create Asset" UI without exposing the
/// disposition / running-totals surface (those are populated by the
/// retire/sell + depreciate workflows rather than direct user entry).
///
/// **Required:** `code`, `name`, `purchaseDate`, `cost`, `currency`,
/// `usefulLifeMonths`, `depreciationMethod`.
///
/// **Optional:** `category`, `supplierId`, `residualValue`,
/// `location`, `custodianEmployeeId`, `condition`, `warrantyUntil`,
/// `insuranceUntil`, `amcContractId`.
///
/// **Server-managed (NOT accepted on input):**
/// `accumulatedDepreciation`, `netBookValue` — populated by
/// `POST /:assetId/depreciate`. `retireOrSell` is also server-managed
/// (set by the retire/sell endpoint once it lands).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFixedAssetInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- identity / classification (★ required) ----- */
    /// Human-readable code (e.g. `LAP-2026-014`). Unique per project by
    /// convention.
    pub code: String,
    pub name: String,

    /* ----- acquisition (★ required core) ----- */
    pub purchase_date: chrono::DateTime<chrono::Utc>,
    pub cost: f64,
    /// ISO-4217 code.
    pub currency: String,

    /* ----- depreciation (★ required core) ----- */
    /// Useful life expressed in months — matches the `Number` shape
    /// used by the existing TS schema.
    pub useful_life_months: u32,
    /// `slm` / `wdv` / `units`.
    pub depreciation_method: String,

    /* ----- classification (optional) ----- */
    #[serde(default)]
    pub category: Option<String>,

    /* ----- acquisition (optional) ----- */
    /// 24-char hex of the supplier (FK into the §10 suppliers
    /// collection).
    #[serde(default)]
    pub supplier_id: Option<String>,

    /* ----- depreciation (optional) ----- */
    #[serde(default)]
    pub residual_value: Option<f64>,

    /* ----- placement / custody (optional) ----- */
    #[serde(default)]
    pub location: Option<String>,
    /// 24-char hex of the custodian employee.
    #[serde(default)]
    pub custodian_employee_id: Option<String>,
    /// `new` / `good` / `fair` / `damaged` / `retired`. Defaults to
    /// `new` when absent.
    #[serde(default)]
    pub condition: Option<String>,

    /* ----- contracts (optional) ----- */
    #[serde(default)]
    pub warranty_until: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub insurance_until: Option<chrono::DateTime<chrono::Utc>>,
    /// 24-char hex of the §12.18 service contract covering this asset.
    #[serde(default)]
    pub amc_contract_id: Option<String>,
}

/// `PATCH /v1/crm/fixed-assets/:assetId` body. Every field is
/// optional; only the fields explicitly sent are modified on the
/// document. The handler always refreshes `updatedAt` regardless of
/// which fields are set.
///
/// **Server-managed fields are NOT mutable here:**
/// `accumulatedDepreciation`, `netBookValue`. Use the
/// dedicated `/depreciate` endpoint for the running totals.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RetireSellEntryInput {
    pub at: chrono::DateTime<chrono::Utc>,
    pub mode: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sale_amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buyer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFixedAssetInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub purchase_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub supplier_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cost: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub useful_life_months: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub depreciation_method: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub residual_value: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custodian_employee_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warranty_until: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub insurance_until: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amc_contract_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub retire_or_sell: Option<RetireSellEntryInput>,
}

impl UpdateFixedAssetInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.code.is_none()
            && self.name.is_none()
            && self.category.is_none()
            && self.purchase_date.is_none()
            && self.supplier_id.is_none()
            && self.cost.is_none()
            && self.currency.is_none()
            && self.useful_life_months.is_none()
            && self.depreciation_method.is_none()
            && self.residual_value.is_none()
            && self.location.is_none()
            && self.custodian_employee_id.is_none()
            && self.condition.is_none()
            && self.warranty_until.is_none()
            && self.insurance_until.is_none()
            && self.amc_contract_id.is_none()
            && self.retire_or_sell.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "code": "LAP-2026-014",
            "name": "ThinkPad X1 Carbon",
            "category": "IT Equipment",
            "purchaseDate": "2026-01-10T00:00:00Z",
            "cost": 145000.0,
            "currency": "INR",
            "usefulLifeMonths": 48,
            "depreciationMethod": "wdv",
            "residualValue": 10000.0,
            "supplierId": "507f1f77bcf86cd799439011",
            "custodianEmployeeId": "507f1f77bcf86cd799439012",
            "condition": "new",
        });
        let input: CreateFixedAssetInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.code, "LAP-2026-014");
        assert_eq!(input.name, "ThinkPad X1 Carbon");
        assert_eq!(input.category.as_deref(), Some("IT Equipment"));
        assert_eq!(input.cost, 145_000.0);
        assert_eq!(input.currency, "INR");
        assert_eq!(input.useful_life_months, 48);
        assert_eq!(input.depreciation_method, "wdv");
        assert_eq!(input.residual_value, Some(10_000.0));
        assert_eq!(
            input.supplier_id.as_deref(),
            Some("507f1f77bcf86cd799439011")
        );
        assert_eq!(
            input.custodian_employee_id.as_deref(),
            Some("507f1f77bcf86cd799439012")
        );
        assert_eq!(input.condition.as_deref(), Some("new"));
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateFixedAssetInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateFixedAssetInput {
            condition: Some("good".into()),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_query_defaults_are_none() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(q.page.is_none());
        assert!(q.limit.is_none());
        assert!(q.q.is_none());
        assert!(q.category.is_none());
        assert!(q.condition.is_none());
        assert!(q.depreciation_method.is_none());
    }

    #[test]
    fn list_query_camel_case_filters() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({
            "category": "IT Equipment",
            "condition": "good",
            "depreciationMethod": "slm",
        }))
        .unwrap();
        assert_eq!(q.category.as_deref(), Some("IT Equipment"));
        assert_eq!(q.condition.as_deref(), Some("good"));
        assert_eq!(q.depreciation_method.as_deref(), Some("slm"));
    }
}
