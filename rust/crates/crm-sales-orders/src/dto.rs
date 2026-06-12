//! Wire-format request DTOs for the sales-order endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_sales_types::SalesOrder`] DTO — we deliberately do not
//! redeclare it here. The shapes below describe only what callers send
//! IN (create-input, update-input, list-query); they are intentionally
//! narrower than the full SalesOrder model so the API surface stays
//! controlled.
//!
//! Field naming matches the existing TS server action
//! `src/app/actions/crm-sales-orders.actions.ts` and the `SalesOrder`
//! struct in `crm-sales-types::sales_order`. All structs use
//! `#[serde(rename_all = "camelCase")]` so JSON requests round-trip
//! with the TS clients.

use crm_sales_types::{DeliveryMethod, LineItem, SalesOrderStatus, Totals};
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/sales-orders` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across the
/// fields most likely to identify a sales order at a glance: `soNo`,
/// `poNo`, and `customerNotes`. `clientId` and `status` narrow further.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** when
    /// the router is mounted in `ScopeMode::Project` (the
    /// `/v1/sabcrm/finance/sales-orders` mount); ignored on the legacy
    /// `userId`-scoped `/v1/crm/sales-orders` mount.
    #[serde(default)]
    pub project_id: Option<String>,
    /// 1-indexed page (matches TS). Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to
    /// [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text search across `soNo` / `poNo` / `customerNotes`.
    #[serde(default)]
    pub q: Option<String>,
    /// Restrict to a single client (24-char hex `ObjectId`).
    #[serde(default)]
    pub client_id: Option<String>,
    /// Restrict to a single status (`open` / `partial` / `fulfilled` /
    /// `closed` / `cancelled`).
    #[serde(default)]
    pub status: Option<String>,
}

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{soId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project`, ignored on the legacy
/// `userId`-scoped mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`).
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `POST /v1/crm/sales-orders` body. The endpoint accepts a curated
/// subset of the full [`crm_sales_types::SalesOrder`] fields — enough
/// to drive the existing "Add Sales Order" UI without exposing the
/// downstream-link surface (`linkedDeliveryIds`, `linkedInvoiceIds`,
/// `lineage`) — those are mutated by the Delivery-from-SO / Invoice-
/// from-SO converters and the create handler's lineage seeding.
///
/// **Required:** `soNo`, `date`, `clientId`, `currency`, `items`,
/// `totals`.
///
/// **Optional doc body:** `quotationRef`, `poNo`, `poDate`,
/// `expectedShipmentDate`, `deliveryMethod`, `paymentTerms`,
/// `customerNotes`, `internalNotes`, `status`, `exchangeRate`.
///
/// **Deferred:** `linkedDeliveryIds`, `linkedInvoiceIds` — server-managed
/// during conversion flows. Sending these on create is a no-op.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSalesOrderInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- doc number + dates (★ required) ----- */
    pub so_no: String,
    pub date: chrono::DateTime<chrono::Utc>,

    /* ----- parties + refs (★ clientId required) ----- */
    pub client_id: String,
    /// Source quotation hex id, when this SO was converted from one.
    #[serde(default)]
    pub quotation_ref: Option<String>,
    /// Customer-side PO number (their internal ref).
    #[serde(default)]
    pub po_no: Option<String>,
    #[serde(default)]
    pub po_date: Option<chrono::DateTime<chrono::Utc>>,

    /* ----- delivery ----- */
    #[serde(default)]
    pub expected_shipment_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub delivery_method: Option<DeliveryMethod>,
    #[serde(default)]
    pub payment_terms: Option<String>,

    /* ----- money settings (★ currency required) ----- */
    pub currency: String,
    #[serde(default)]
    pub exchange_rate: Option<f64>,

    /* ----- line items + totals (★ required) ----- */
    pub items: Vec<LineItem>,
    pub totals: Totals,

    /* ----- doc body ----- */
    #[serde(default)]
    pub customer_notes: Option<String>,
    #[serde(default)]
    pub internal_notes: Option<String>,

    /* ----- workflow ----- */
    /// Defaults to `SalesOrderStatus::Open` when absent.
    #[serde(default)]
    pub status: Option<SalesOrderStatus>,

    /* ----- lineage seeding (mirrors `saveSalesOrder` TS action) ----- */
    /// One of `quotation` | `lead` | `deal` | `proforma`. Anything else
    /// is silently ignored (matches the TS `ALLOWED_PARENT_KINDS`
    /// guard).
    #[serde(default)]
    pub from_kind: Option<String>,
    /// 24-char hex of the parent record. Used together with `fromKind`
    /// to seed `lineage[]`.
    #[serde(default)]
    pub from_id: Option<String>,

    /* ----- design ----- */
    #[serde(default)]
    pub design_metadata: Option<serde_json::Value>,
}

/// `PATCH /v1/crm/sales-orders/:soId` body. Every field is optional;
/// only the fields explicitly sent are modified on the document. The
/// handler always refreshes `updatedAt`/`updatedBy` regardless of
/// which fields are set.
///
/// `linkedDeliveryIds` / `linkedInvoiceIds` / `lineage` / `clientId` /
/// `soNo` are intentionally NOT mutable here — those evolve via
/// dedicated server-managed flows.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSalesOrderInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<chrono::DateTime<chrono::Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quotation_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub po_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub po_date: Option<chrono::DateTime<chrono::Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_shipment_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delivery_method: Option<DeliveryMethod>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_terms: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<LineItem>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub totals: Option<Totals>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub internal_notes: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<SalesOrderStatus>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design_metadata: Option<serde_json::Value>,
}

impl UpdateSalesOrderInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.date.is_none()
            && self.quotation_ref.is_none()
            && self.po_no.is_none()
            && self.po_date.is_none()
            && self.expected_shipment_date.is_none()
            && self.delivery_method.is_none()
            && self.payment_terms.is_none()
            && self.currency.is_none()
            && self.exchange_rate.is_none()
            && self.items.is_none()
            && self.totals.is_none()
            && self.customer_notes.is_none()
            && self.internal_notes.is_none()
            && self.status.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "soNo": "SO-00042",
            "date": "2025-04-01T00:00:00Z",
            "clientId": "507f1f77bcf86cd799439011",
            "currency": "INR",
            "items": [],
            "totals": { "subTotal": 0.0, "total": 0.0 },
            "poNo": "PO-7821",
            "expectedShipmentDate": "2025-04-15T00:00:00Z",
            "deliveryMethod": "courier",
            "paymentTerms": "Net 30",
            "customerNotes": "Handle with care.",
            "fromKind": "quotation",
            "fromId": "507f1f77bcf86cd799439012",
        });
        let input: CreateSalesOrderInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.so_no, "SO-00042");
        assert_eq!(input.client_id, "507f1f77bcf86cd799439011");
        assert_eq!(input.currency, "INR");
        assert_eq!(input.po_no.as_deref(), Some("PO-7821"));
        assert!(matches!(
            input.delivery_method,
            Some(DeliveryMethod::Courier)
        ));
        assert_eq!(input.payment_terms.as_deref(), Some("Net 30"));
        assert_eq!(input.from_kind.as_deref(), Some("quotation"));
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateSalesOrderInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateSalesOrderInput {
            status: Some(SalesOrderStatus::Fulfilled),
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
        assert!(q.client_id.is_none());
        assert!(q.status.is_none());
    }

    #[test]
    fn list_query_parses_status_filter() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({
            "status": "fulfilled",
            "clientId": "507f1f77bcf86cd799439011",
            "limit": 50,
        }))
        .unwrap();
        assert_eq!(q.status.as_deref(), Some("fulfilled"));
        assert_eq!(q.client_id.as_deref(), Some("507f1f77bcf86cd799439011"));
        assert_eq!(q.limit, Some(50));
    }
}
