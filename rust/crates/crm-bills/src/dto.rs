//! Wire-format request DTOs for the bill endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_purchases_types::Bill`] DTO — we deliberately do not redeclare
//! it here. The shapes below describe only what callers send IN
//! (create-input, update-input, list-query); they are intentionally
//! narrower than the full Bill model so the API surface stays
//! controlled.
//!
//! Field naming matches the §2.3 spec in `crm_function_plan.md` and the
//! `Bill` struct in `crm-purchases-types::bill`. All structs use
//! `#[serde(rename_all = "camelCase")]` so JSON requests round-trip
//! with the TS clients.
//!
//! ## What's exposed vs deferred
//!
//! **Exposed on create:** required (`bill_date`, `vendor_id`,
//! `currency`, `totals`); optional (`bill_no`, `vendor_invoice_no`,
//! `due_date`, `items[]`, `expense_lines[]`, `tds_section`,
//! `tds_amount`, `reverse_charge`, `place_of_supply`, `recurring`,
//! `notes`).
//!
//! **Deferred / server-managed:** `amount_paid`, `balance`
//! (maintained by payout-receipt allocations), `status` (driven by
//! payout reconciliation — bills start in `Draft`), `linked_po_id`
//! (seeded when `fromKind = "purchaseOrder"`), `linked_grn_ids`
//! (seeded when `fromKind = "grn"`). Direct user entry of these would
//! corrupt the AP audit trail.
//!
//! ## items / expense_lines / totals / recurring
//!
//! `items[]`, `expense_lines[]`, `totals`, and `recurring` round-trip
//! as raw `serde_json::Value` here — the wire shapes mirror the
//! `LineItem` / `ExpenseLine` / `Totals` / `RecurringConfig` structs in
//! `crm-sales-types` / `crm-purchases-types`, but we keep this DTO
//! crate decoupled from them on the request side. The handler converts
//! the `Value` into `Bson` via `bson::to_bson` at insert time so any
//! structure that round-trips through serde_json works.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/bills` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across
/// `billNo` and `vendorInvoiceNo` — both are common scan keys in the AP
/// UI. `vendor_id` and `status` narrow further.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** when
    /// the router is mounted in `ScopeMode::Project` (the
    /// `/v1/sabcrm/finance/bills` mount); ignored on the legacy
    /// `userId`-scoped `/v1/crm/bills` mount.
    #[serde(default)]
    pub project_id: Option<String>,
    /// 1-indexed page (matches TS). Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to
    /// [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text search across `billNo` / `vendorInvoiceNo`.
    #[serde(default)]
    pub q: Option<String>,
    /// Restrict to a single vendor (24-char hex).
    #[serde(default)]
    pub vendor_id: Option<String>,
    /// Restrict to a workflow status — one of the lower-case
    /// [`crm_purchases_types::BillStatus`] variants
    /// ("draft", "submitted", "approved", "paid", "partially_paid",
    /// "overdue", "cancelled").
    #[serde(default)]
    pub status: Option<String>,
}

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{billId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project`, ignored on the legacy
/// `userId`-scoped mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`).
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `POST /v1/crm/bills` body. Required: `billDate`, `vendorId`,
/// `currency`, `totals`. Everything else is optional.
///
/// **Deferred:** `amount_paid`, `balance`, `status`, `linked_po_id`,
/// `linked_grn_ids` — see the module-level docs.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBillInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- doc numbers + dates (★ bill_date required) ----- */
    /// Internal bill number we generate (e.g. "BILL-2026-0001"). Tenant-
    /// scoped uniqueness is enforced by upstream sequence allocators —
    /// not by this handler.
    #[serde(default)]
    pub bill_no: Option<String>,
    /// Vendor's invoice number printed on their original document.
    #[serde(default)]
    pub vendor_invoice_no: Option<String>,
    /// Bill issue date (tax point).
    pub bill_date: chrono::DateTime<chrono::Utc>,
    /// Optional payment due date (drives AP ageing buckets).
    #[serde(default)]
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,

    /* ----- parties (★ vendor required) ----- */
    /// 24-char hex of the supplying vendor. Required.
    pub vendor_id: String,

    /* ----- body (one or both vectors populated) ----- */
    /// Inventory-line items. Populated when the bill is against goods.
    /// Each element should round-trip into the `LineItem` shape from
    /// `crm-sales-types::line_item`. Stored verbatim via `bson::to_bson`.
    #[serde(default)]
    pub items: Option<Vec<Value>>,
    /// Direct-to-ledger expense lines. Populated for service / utility
    /// / rent / overhead bills. Each element should round-trip into
    /// `ExpenseLine` from `crm-purchases-types::bill`.
    #[serde(default)]
    pub expense_lines: Option<Vec<Value>>,

    /* ----- TDS + reverse-charge ----- */
    /// TDS section code (e.g. "194C", "194J") when withholding tax
    /// applies.
    #[serde(default)]
    pub tds_section: Option<String>,
    /// Withholding amount deducted from the vendor payout.
    #[serde(default)]
    pub tds_amount: Option<f64>,
    /// `true` when the bill falls under GST reverse-charge (recipient
    /// pays GST instead of the supplier).
    #[serde(default)]
    pub reverse_charge: Option<bool>,
    /// Place-of-supply code (Indian state code) for cross-state GST
    /// classification.
    #[serde(default)]
    pub place_of_supply: Option<String>,

    /* ----- money (★ currency + totals required) ----- */
    /// ISO-4217 code. No default — the caller MUST be explicit so
    /// multi-currency vendors don't accidentally fall back.
    pub currency: String,
    /// Optional FX rate to base currency (used when `currency` differs
    /// from the tenant's base currency).
    #[serde(default)]
    pub exchange_rate: Option<f64>,
    /// Document-level totals. Should round-trip into `Totals` from
    /// `crm-sales-types::line_item`.
    pub totals: Value,

    /* ----- recurring ----- */
    /// Optional recurring config (rent, AMC, subscriptions). Should
    /// round-trip into `RecurringConfig` from `crm-sales-types`.
    #[serde(default)]
    pub recurring: Option<Value>,

    /* ----- doc body ----- */
    /// Free-form notes / memo printed on the AP voucher.
    #[serde(default)]
    pub notes: Option<String>,

    /* ----- §13.5 lineage seeding ----- */
    /// Logical kind of the parent record this Bill was created FROM.
    /// Honoured values: `"purchaseOrder"`, `"grn"`. Other values are
    /// silently ignored.
    #[serde(default)]
    pub from_kind: Option<String>,
    /// 24-char hex of the parent record.
    #[serde(default)]
    pub from_id: Option<String>,
}

/// `PATCH /v1/crm/bills/:billId` body. Every field is optional; only
/// the fields explicitly sent are modified on the document. The handler
/// always refreshes `updatedAt` regardless of which fields are set.
///
/// **NOT updatable here:** `amount_paid`, `balance`, `linked_po_id`,
/// `linked_grn_ids`, `lineage` — these are server-managed via dedicated
/// endpoints. Likewise `bill_no` is intentionally immutable at this
/// layer (the AP audit trail relies on stable doc numbers — rotate via
/// cancel + new-bill instead).
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBillInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_invoice_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bill_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expense_lines: Option<Vec<Value>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_section: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reverse_charge: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub place_of_supply: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub totals: Option<Value>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurring: Option<Value>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// Workflow status — one of the lower-case
    /// [`crm_purchases_types::BillStatus`] variants.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

impl UpdateBillInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.vendor_invoice_no.is_none()
            && self.bill_date.is_none()
            && self.due_date.is_none()
            && self.vendor_id.is_none()
            && self.items.is_none()
            && self.expense_lines.is_none()
            && self.tds_section.is_none()
            && self.tds_amount.is_none()
            && self.reverse_charge.is_none()
            && self.place_of_supply.is_none()
            && self.currency.is_none()
            && self.exchange_rate.is_none()
            && self.totals.is_none()
            && self.recurring.is_none()
            && self.notes.is_none()
            && self.status.is_none()
    }
}

/// Lower-case workflow status strings accepted on `ListQuery::status`
/// and `UpdateBillInput::status`. Mirrors the
/// `#[serde(rename_all = "snake_case")]` representation of
/// [`crm_purchases_types::BillStatus`].
pub const ALLOWED_STATUSES: &[&str] = &[
    "draft",
    "submitted",
    "approved",
    "paid",
    "partially_paid",
    "overdue",
    "cancelled",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "billDate": "2026-05-07T00:00:00Z",
            "vendorId": "507f1f77bcf86cd799439011",
            "currency": "INR",
            "totals": { "subTotal": 1000.0, "total": 1180.0 },
            "billNo": "BILL-2026-0001",
            "vendorInvoiceNo": "INV-9876",
            "dueDate": "2026-06-06T00:00:00Z",
            "tdsSection": "194C",
            "tdsAmount": 20.0,
            "reverseCharge": true,
            "placeOfSupply": "27",
            "expenseLines": [
                { "accountId": "507f1f77bcf86cd799439012", "amount": 1000.0 }
            ],
            "fromKind": "purchaseOrder",
            "fromId": "507f1f77bcf86cd799439013",
        });
        let input: CreateBillInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.vendor_id, "507f1f77bcf86cd799439011");
        assert_eq!(input.currency, "INR");
        assert_eq!(input.bill_no.as_deref(), Some("BILL-2026-0001"));
        assert_eq!(input.vendor_invoice_no.as_deref(), Some("INV-9876"));
        assert_eq!(input.tds_section.as_deref(), Some("194C"));
        assert_eq!(input.tds_amount, Some(20.0));
        assert_eq!(input.reverse_charge, Some(true));
        assert_eq!(input.place_of_supply.as_deref(), Some("27"));
        assert!(input.due_date.is_some());
        assert_eq!(input.expense_lines.as_ref().map(|v| v.len()), Some(1));
        assert_eq!(input.from_kind.as_deref(), Some("purchaseOrder"));
        assert_eq!(input.from_id.as_deref(), Some("507f1f77bcf86cd799439013"));
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateBillInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateBillInput {
            status: Some("approved".into()),
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
        assert!(q.vendor_id.is_none());
        assert!(q.status.is_none());
    }

    #[test]
    fn allowed_statuses_covers_all_variants() {
        // If a new variant is added to BillStatus, this test should be
        // updated too — keep the list in sync.
        assert_eq!(ALLOWED_STATUSES.len(), 7);
        assert!(ALLOWED_STATUSES.contains(&"draft"));
        assert!(ALLOWED_STATUSES.contains(&"partially_paid"));
        assert!(ALLOWED_STATUSES.contains(&"cancelled"));
    }
}
