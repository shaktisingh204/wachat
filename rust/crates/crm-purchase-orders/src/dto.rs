//! Wire-format request DTOs for the purchase-order endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_purchases_types::PurchaseOrder`] DTO — we deliberately do not
//! redeclare it here. The shapes below describe only what callers send
//! IN (create-input, update-input, list-query); they are intentionally
//! narrower than the full PurchaseOrder model so the API surface stays
//! controlled.
//!
//! Field naming matches the §2.2 spec in `crm_function_plan.md` and the
//! `PurchaseOrder` struct in `crm-purchases-types::purchase_order`. All
//! structs use `#[serde(rename_all = "camelCase")]` so JSON requests
//! round-trip with the TS clients.
//!
//! ## What's exposed vs deferred
//!
//! **Exposed on create:** required (`po_no`, `date`, `vendor_id`,
//! `currency`, `items[]`, `totals`); optional (`expected_delivery`,
//! `ship_to_warehouse_id`, `billing_branch_id`, `payment_terms`,
//! `terms_and_conditions`, `notes`).
//!
//! **Deferred / server-managed:** `approval` (driven by a dedicated
//! approval endpoint), `linked_grn_ids` (populated by GRN
//! reconciliation), `linked_bill_ids` (populated when bills are
//! issued). Direct user entry of these would corrupt the procurement
//! audit trail.
//!
//! ## items / totals
//!
//! `items[]` and `totals` round-trip as raw `serde_json::Value` here —
//! the wire shape mirrors the `LineItem` / `Totals` structs in
//! `crm-sales-types`, but we keep this crate decoupled from
//! `crm-sales-types` (per the slice contract — `crm-purchases-types`
//! transitively depends on it for the response shape, but the request
//! DTOs do not). The handler converts the `Value` into `Bson` via
//! `bson::to_bson` at insert time so any structure that round-trips
//! through serde_json works.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/purchase-orders` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across
/// `poNo` (the human-facing PO number — primary identifier in the
/// procurement UI). `vendor_id` and `status` narrow further.
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
    /// Free-text search across `poNo`.
    #[serde(default)]
    pub q: Option<String>,
    /// Restrict to a single vendor (24-char hex).
    #[serde(default)]
    pub vendor_id: Option<String>,
    /// Restrict to a workflow status — one of the lower-case
    /// [`crm_purchases_types::PurchaseOrderStatus`] variants
    /// ("draft", "awaiting_approval", "approved", "sent", "partial",
    /// "received", "closed", "cancelled").
    #[serde(default)]
    pub status: Option<String>,
    /// SabCRM suite scope — required on `/v1/sabcrm/supply/*` mounts,
    /// ignored on the legacy `userId` mount.
    #[serde(default)]
    pub project_id: Option<String>,
}

/// Query for single-document routes (`GET`/`PATCH`/`DELETE /{id}`) —
/// carries the SabCRM `projectId` on project-scoped mounts.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `POST /v1/crm/purchase-orders` body. Required: `poNo`, `date`,
/// `vendorId`, `currency`, `items`, `totals`. Everything else is
/// optional.
///
/// **Deferred:** `approval`, `linked_grn_ids`, `linked_bill_ids` — see
/// the module-level docs.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePurchaseOrderInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- doc number + dates (★ required for po_no/date) ----- */
    /// Human-facing PO number (e.g. "PO-2026-0001"). Tenant-scoped
    /// uniqueness is enforced by upstream sequence allocators — not by
    /// this handler.
    pub po_no: String,
    /// PO issue date.
    pub date: chrono::DateTime<chrono::Utc>,
    /// Optional expected-delivery target.
    #[serde(default)]
    pub expected_delivery: Option<chrono::DateTime<chrono::Utc>>,

    /* ----- parties + locations (★ vendor required) ----- */
    /// 24-char hex of the supplying vendor. Required.
    pub vendor_id: String,
    /// Receiving warehouse — required for GRN reconciliation when the
    /// PO matures, but optional at create time so drafts can be saved
    /// before the warehouse is decided.
    #[serde(default)]
    pub ship_to_warehouse_id: Option<String>,
    /// Multi-branch tenants pick the billing entity here.
    #[serde(default)]
    pub billing_branch_id: Option<String>,
    /// Free-form payment terms ("Net 30", "50% advance / 50% on
    /// delivery", …).
    #[serde(default)]
    pub payment_terms: Option<String>,

    /* ----- money (★ currency required) ----- */
    /// ISO-4217 code. No default — the caller MUST be explicit so
    /// multi-currency vendors don't accidentally fall back.
    pub currency: String,

    /* ----- line items + totals (★ both required) ----- */
    /// Line-items array. Each element should round-trip into the
    /// `LineItem` shape from `crm-sales-types::line_item`. Stored
    /// verbatim via `bson::to_bson`.
    pub items: Vec<Value>,
    /// Document-level totals. Should round-trip into `Totals` from
    /// `crm-sales-types::line_item`.
    pub totals: Value,

    /* ----- doc body ----- */
    #[serde(default)]
    pub terms_and_conditions: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,

    /* ----- §13.5 lineage seeding ----- */
    /// Logical kind of the parent record this PO was created FROM.
    /// Honoured values: `"rfq"`, `"vendorBid"`. Other values are
    /// silently ignored.
    #[serde(default)]
    pub from_kind: Option<String>,
    /// 24-char hex of the parent record.
    #[serde(default)]
    pub from_id: Option<String>,
}

/// `PATCH /v1/crm/purchase-orders/:poId` body. Every field is optional;
/// only the fields explicitly sent are modified on the document. The
/// handler always refreshes `updatedAt` regardless of which fields are
/// set.
///
/// **NOT updatable here:** `approval`, `linked_grn_ids`,
/// `linked_bill_ids` — these are server-managed via dedicated
/// endpoints. Likewise `po_no` is intentionally immutable at this
/// layer (the procurement audit trail relies on stable doc numbers —
/// rotate via cancel + new-PO instead).
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePurchaseOrderInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_delivery: Option<chrono::DateTime<chrono::Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ship_to_warehouse_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing_branch_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_terms: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub totals: Option<Value>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms_and_conditions: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// Workflow status — one of the lower-case
    /// [`crm_purchases_types::PurchaseOrderStatus`] variants.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

impl UpdatePurchaseOrderInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.date.is_none()
            && self.expected_delivery.is_none()
            && self.vendor_id.is_none()
            && self.ship_to_warehouse_id.is_none()
            && self.billing_branch_id.is_none()
            && self.payment_terms.is_none()
            && self.currency.is_none()
            && self.items.is_none()
            && self.totals.is_none()
            && self.terms_and_conditions.is_none()
            && self.notes.is_none()
            && self.status.is_none()
    }
}

/// Lower-case workflow status strings accepted on `ListQuery::status`
/// and `UpdatePurchaseOrderInput::status`. Mirrors the
/// `#[serde(rename_all = "snake_case")]` representation of
/// [`crm_purchases_types::PurchaseOrderStatus`].
pub const ALLOWED_STATUSES: &[&str] = &[
    "draft",
    "awaiting_approval",
    "approved",
    "sent",
    "partial",
    "received",
    "closed",
    "cancelled",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "poNo": "PO-2026-0001",
            "date": "2026-05-07T00:00:00Z",
            "vendorId": "507f1f77bcf86cd799439011",
            "currency": "INR",
            "items": [
                { "qty": 2.0, "rate": 100.0, "total": 200.0 }
            ],
            "totals": { "subTotal": 200.0, "total": 236.0 },
            "expectedDelivery": "2026-05-20T00:00:00Z",
            "paymentTerms": "Net 30",
        });
        let input: CreatePurchaseOrderInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.po_no, "PO-2026-0001");
        assert_eq!(input.vendor_id, "507f1f77bcf86cd799439011");
        assert_eq!(input.currency, "INR");
        assert_eq!(input.items.len(), 1);
        assert_eq!(input.payment_terms.as_deref(), Some("Net 30"));
        assert!(input.expected_delivery.is_some());
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdatePurchaseOrderInput::default();
        assert!(empty.is_empty());

        let with_field = UpdatePurchaseOrderInput {
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
        // If a new variant is added to PurchaseOrderStatus, this test
        // should be updated too — keep the list in sync.
        assert_eq!(ALLOWED_STATUSES.len(), 8);
        assert!(ALLOWED_STATUSES.contains(&"draft"));
        assert!(ALLOWED_STATUSES.contains(&"cancelled"));
        assert!(ALLOWED_STATUSES.contains(&"awaiting_approval"));
    }
}
