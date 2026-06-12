//! Wire-format request DTOs for the quotation endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_sales_types::Quotation`] DTO — we deliberately do not redeclare
//! it here. The shapes below describe only what callers send IN
//! (create-input, update-input, list-query); they are intentionally
//! narrower than the full Quotation model so the API surface stays
//! controlled.
//!
//! Field naming matches the existing TS `CrmQuotation` shape
//! (`src/lib/definitions.ts`) and the `Quotation` struct in
//! `crm-sales-types::quotation`. All structs use
//! `#[serde(rename_all = "camelCase")]` so JSON requests round-trip
//! with the TS clients.
//!
//! ## Curated subset
//!
//! Only entry-friendly fields are accepted on the wire — rich auxiliary
//! fragments (`lineage[]`, `convertedTo[]`, `revisionHistory[]`,
//! `emailLog[]`, `whatsappSendLog[]`, `pdfStatus`) are server-side state
//! the user does not edit directly. They evolve through dedicated
//! workflows (PDF render pipeline, conversion endpoints, comm webhooks)
//! rather than free-form patches.

use chrono::{DateTime, Utc};
use crm_sales_types::LineItem;
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/quotations` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across the
/// fields most likely to identify a quotation at a glance:
/// `quotationNo`, `subject`, and `referenceNo`.
///
/// `fromKind` + `fromId` are accepted on the LIST endpoint as well so
/// the UI can pre-populate the "create quotation from this deal/lead"
/// affordance — they're echoed back as part of the request log but do
/// not filter the results today (the conversion endpoints will consume
/// them once they land).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** when
    /// the router is mounted in `ScopeMode::Project` (the
    /// `/v1/sabcrm/finance/quotations` mount); ignored on the legacy
    /// `userId`-scoped `/v1/crm/quotations` mount.
    #[serde(default)]
    pub project_id: Option<String>,
    /// 1-indexed page (matches TS). Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to
    /// [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text search.
    #[serde(default)]
    pub q: Option<String>,
    /// Restrict to a single client.
    #[serde(default)]
    pub client_id: Option<String>,
    /// Restrict by workflow status (`draft`, `sent`, `accepted`, …).
    #[serde(default)]
    pub status: Option<String>,
    /// Lineage parent kind (`"lead"` | `"deal"`) — accepted for
    /// forward-compat with the conversion UX; not yet used as a filter.
    #[serde(default)]
    pub from_kind: Option<String>,
    /// Lineage parent id — accepted for forward-compat with the
    /// conversion UX; not yet used as a filter.
    #[serde(default)]
    pub from_id: Option<String>,
}

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{quotationId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project`, ignored on the legacy
/// `userId`-scoped mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`).
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `POST /v1/crm/quotations` body. The endpoint accepts a curated subset
/// of the full [`crm_sales_types::Quotation`] fields — enough to drive
/// the existing "Create Quotation" UI without exposing the heavy
/// communication-log / revision-history / converted-to surface. Those
/// are populated by domain workflows (PDF render, email/WA sender,
/// conversion endpoints) rather than direct user entry.
///
/// **Exposed:** doc identity (`quotationNo`, `date`, `validUntil`,
/// optional `projectId`), party (`clientId`), money (`currency`,
/// optional `placeOfSupply`), body (`subject`, `termsAndConditions`,
/// `notes`), `items[]` (full `LineItem` round-trip), and the lineage
/// hooks (`fromKind` + `fromId`).
///
/// **Deferred:** `lineage[]`, `convertedTo[]`, `revisionHistory[]`,
/// `emailLog[]`, `whatsappSendLog[]`, `pdfStatus`, `templateId`,
/// `signatureImageFileId`, `thumbnailFileId`, `attachments`,
/// `billingAddress`, `shippingAddress`, `exchangeRate`, `referenceNo`,
/// `salesAgentId`, `dealId`. Quotation owners patch these via dedicated
/// downstream endpoints once those land.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateQuotationInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- doc identity (★ required) ----- */
    /// Tenant-issued quotation number (e.g. `"QT-2026-0042"`). Uniqueness
    /// is the action layer's responsibility — the Rust BFF only enforces
    /// non-empty.
    pub quotation_no: String,
    /// Quotation issue date (RFC 3339 on the wire; the handler converts
    /// to a BSON datetime at persist time, matching `crm-invoices`).
    pub date: DateTime<Utc>,
    /// Validity expiry — quotations past this date should not be
    /// honoured by downstream conversion flows.
    pub valid_until: DateTime<Utc>,

    /* ----- party (★ required) ----- */
    /// Hex-encoded `ObjectId` of the `crm_clients` row this quotation is
    /// addressed to.
    pub client_id: String,

    /* ----- money (★ required) ----- */
    /// ISO-4217 code (e.g. `"INR"`).
    pub currency: String,
    /// GST place-of-supply override (Indian-tax-only — null elsewhere).
    #[serde(default)]
    pub place_of_supply: Option<String>,

    /* ----- doc body ----- */
    /// Short headline above the items table.
    #[serde(default)]
    pub subject: Option<String>,
    /// Free-form Markdown stored verbatim and rendered onto the PDF.
    #[serde(default)]
    pub terms_and_conditions: Option<String>,
    /// Customer-facing free-form notes (renders below the totals on the
    /// PDF). Maps to `customerNotes` on the canonical [`Quotation`]
    /// struct — exposed here as `notes` to match the simpler TS form.
    #[serde(default, alias = "customer_notes")]
    pub notes: Option<String>,

    /* ----- line items (★ required) ----- */
    /// At least one line item is required. The handler enforces a
    /// non-empty array.
    #[serde(default)]
    pub items: Vec<LineItem>,

    /* ----- lineage hooks ----- */
    /// Logical kind of a parent record this quotation was created FROM
    /// (`"lead"` or `"deal"`). When paired with `fromId`, the handler
    /// seeds `lineage[]` via [`crm_core::build_lineage_from_parent`] and
    /// pushes a best-effort back-link onto the parent's `lineage[]`.
    #[serde(default)]
    pub from_kind: Option<String>,
    /// 24-char hex of the parent record. See [`Self::from_kind`].
    #[serde(default)]
    pub from_id: Option<String>,

    /* ----- design ----- */
    #[serde(default)]
    pub design_metadata: Option<serde_json::Value>,
}

/// `PATCH /v1/crm/quotations/:quotationId` body. Every field is
/// optional; only the fields explicitly sent are modified on the
/// document. The handler always refreshes `updatedAt` regardless of
/// which fields are set.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateQuotationInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quotation_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub valid_until: Option<DateTime<Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub place_of_supply: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms_and_conditions: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        alias = "customer_notes"
    )]
    pub notes: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    /// Replace the entire `items[]` array. Sending an empty array is
    /// rejected (a quotation with no lines doesn't render).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<LineItem>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design_metadata: Option<serde_json::Value>,
}

impl UpdateQuotationInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.quotation_no.is_none()
            && self.date.is_none()
            && self.valid_until.is_none()
            && self.client_id.is_none()
            && self.currency.is_none()
            && self.place_of_supply.is_none()
            && self.subject.is_none()
            && self.terms_and_conditions.is_none()
            && self.notes.is_none()
            && self.status.is_none()
            && self.items.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "quotationNo": "QT-2026-0042",
            "date": "2026-05-01T00:00:00Z",
            "validUntil": "2026-05-31T00:00:00Z",
            "clientId": "507f1f77bcf86cd799439011",
            "currency": "INR",
            "placeOfSupply": "27",
            "subject": "Q3 hosting renewal",
            "termsAndConditions": "Net 30. Prices in INR.",
            "notes": "Pricing valid till month-end.",
            "items": [
                { "qty": 2.0, "rate": 1500.0, "total": 3000.0 }
            ],
            "fromKind": "deal",
            "fromId": "507f1f77bcf86cd799439022",
        });
        let input: CreateQuotationInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.quotation_no, "QT-2026-0042");
        assert_eq!(input.client_id, "507f1f77bcf86cd799439011");
        assert_eq!(input.currency, "INR");
        assert_eq!(input.place_of_supply.as_deref(), Some("27"));
        assert_eq!(input.subject.as_deref(), Some("Q3 hosting renewal"));
        assert_eq!(
            input.notes.as_deref(),
            Some("Pricing valid till month-end.")
        );
        assert_eq!(input.items.len(), 1);
        assert_eq!(input.items[0].qty, 2.0);
        assert_eq!(input.items[0].rate, 1500.0);
        assert_eq!(input.from_kind.as_deref(), Some("deal"));
    }

    #[test]
    fn create_input_accepts_customer_notes_alias() {
        // The canonical Quotation field is `customerNotes`; we expose it
        // as `notes` on the wire but accept the long form via alias so
        // existing TS clients don't have to rename keys.
        let json = serde_json::json!({
            "quotationNo": "QT-1",
            "date": "2026-05-01T00:00:00Z",
            "validUntil": "2026-05-31T00:00:00Z",
            "clientId": "507f1f77bcf86cd799439011",
            "currency": "INR",
            "customer_notes": "Hi from the alias.",
            "items": [],
        });
        let input: CreateQuotationInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.notes.as_deref(), Some("Hi from the alias."));
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateQuotationInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateQuotationInput {
            status: Some("sent".into()),
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
        assert!(q.from_kind.is_none());
        assert!(q.from_id.is_none());
    }
}
