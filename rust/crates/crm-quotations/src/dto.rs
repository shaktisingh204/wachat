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
use crm_core::Attachment;
use crm_sales_types::{Address, LineItem, Totals};
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
/// optional `projectId`), party (`clientId`, `referenceNo`,
/// `salesAgentId`, `dealId`, `subject`), money (`currency`,
/// `exchangeRate`, optional `placeOfSupply`), addresses
/// (`billingAddress`, `shippingAddress`), body (`termsAndConditions`,
/// `notes`, `attachments[]`), `items[]` + `totals` (full round-trip —
/// when `totals` is absent the handler derives it from `items[]`
/// instead of persisting zeros: finance-rollout gap G1), an optional
/// initial `status`, and the lineage hooks (`fromKind` + `fromId`).
///
/// **Deferred:** `lineage[]`, `convertedTo[]`, `revisionHistory[]`,
/// `emailLog[]`, `whatsappSendLog[]`, `pdfStatus`, `templateId`,
/// `signatureImageFileId`, `thumbnailFileId`. Those are server-side
/// state mutated by dedicated workflows (PDF render pipeline,
/// conversion endpoints, comm webhooks).
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
    /// Free-form customer/internal reference number (G2).
    #[serde(default)]
    pub reference_no: Option<String>,
    /// Hex-encoded `ObjectId` of the agent credited with the sale (G2).
    #[serde(default)]
    pub sales_agent_id: Option<String>,
    /// Hex-encoded `ObjectId` of the originating `crm_deals` row (G2).
    /// Distinct from the `fromKind`/`fromId` lineage hooks — this is the
    /// denormalized FK stored on the doc itself.
    #[serde(default)]
    pub deal_id: Option<String>,

    /* ----- money (★ required) ----- */
    /// ISO-4217 code (e.g. `"INR"`).
    pub currency: String,
    /// FX rate vs the tenant base currency (G2). Must be finite and
    /// positive when present.
    #[serde(default)]
    pub exchange_rate: Option<f64>,
    /// GST place-of-supply override (Indian-tax-only — null elsewhere).
    #[serde(default)]
    pub place_of_supply: Option<String>,

    /* ----- addresses (G2) ----- */
    #[serde(default)]
    pub billing_address: Option<Address>,
    #[serde(default)]
    pub shipping_address: Option<Address>,

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

    /* ----- attachments (SabFiles pointers; §crm-core policy) ----- */
    /// Optional SabFiles attachments captured at create time (G1). Each
    /// entry is a `crm_core::Attachment` (`fileId` + cached
    /// name/mime/size). Absent ⇒ the document starts with no
    /// attachments (unchanged legacy behaviour).
    #[serde(default)]
    pub attachments: Option<Vec<Attachment>>,

    /* ----- line items + totals (★ items required) ----- */
    /// At least one line item is required. The handler enforces a
    /// non-empty array.
    #[serde(default)]
    pub items: Vec<LineItem>,
    /// Document-level totals (G1). When absent the handler derives
    /// `subTotal`/`total` from `items[]` (Σ line totals) instead of
    /// persisting `Totals::default()` zeros.
    #[serde(default)]
    pub totals: Option<Totals>,

    /* ----- workflow ----- */
    /// Initial workflow status (G1). Defaults to `draft`; must be one of
    /// the `QuotationStatus` lowercase literals when present.
    #[serde(default)]
    pub status: Option<String>,

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
    pub reference_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sales_agent_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deal_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub place_of_supply: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing_address: Option<Address>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shipping_address: Option<Address>,

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
    /// Replace the document-level totals (G1). Senders that patch
    /// `items` SHOULD send recomputed `totals` alongside so the two
    /// stay consistent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub totals: Option<Totals>,

    /// Full replacement of the attachments array (SabFiles pointers,
    /// G1). Sending `[]` clears all attachments.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Attachment>>,

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
            && self.reference_no.is_none()
            && self.sales_agent_id.is_none()
            && self.deal_id.is_none()
            && self.currency.is_none()
            && self.exchange_rate.is_none()
            && self.place_of_supply.is_none()
            && self.billing_address.is_none()
            && self.shipping_address.is_none()
            && self.subject.is_none()
            && self.terms_and_conditions.is_none()
            && self.notes.is_none()
            && self.status.is_none()
            && self.items.is_none()
            && self.totals.is_none()
            && self.attachments.is_none()
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

    /// G1+G2 — the create body now accepts `totals`, `attachments`,
    /// `status`, `exchangeRate`, `salesAgentId`, `dealId`,
    /// `referenceNo`, and both addresses. Pin the camelCase round-trip.
    #[test]
    fn create_input_round_trips_g1_g2_fields() {
        let json = serde_json::json!({
            "quotationNo": "QT-2026-0099",
            "date": "2026-06-01T00:00:00Z",
            "validUntil": "2026-06-30T00:00:00Z",
            "clientId": "507f1f77bcf86cd799439011",
            "referenceNo": "REF-77",
            "salesAgentId": "507f1f77bcf86cd799439033",
            "dealId": "507f1f77bcf86cd799439044",
            "currency": "INR",
            "exchangeRate": 83.25,
            "billingAddress": { "line1": "12 MG Road", "city": "Pune", "pincode": "411001" },
            "shippingAddress": { "line1": "Plot 9", "city": "Mumbai", "label": "Warehouse-A" },
            "items": [
                { "qty": 2.0, "rate": 1500.0, "total": 3000.0 }
            ],
            "totals": {
                "subTotal": 3000.0,
                "discountOverall": 100.0,
                "total": 2900.0
            },
            "attachments": [
                { "fileId": "507f1f77bcf86cd799439055", "name": "scope.pdf", "mimeType": "application/pdf", "size": 1024 }
            ],
            "status": "sent",
        });
        let input: CreateQuotationInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.reference_no.as_deref(), Some("REF-77"));
        assert_eq!(
            input.sales_agent_id.as_deref(),
            Some("507f1f77bcf86cd799439033")
        );
        assert_eq!(input.deal_id.as_deref(), Some("507f1f77bcf86cd799439044"));
        assert_eq!(input.exchange_rate, Some(83.25));
        let billing = input.billing_address.as_ref().expect("billing parsed");
        assert_eq!(billing.line1.as_deref(), Some("12 MG Road"));
        assert_eq!(billing.pincode.as_deref(), Some("411001"));
        let shipping = input.shipping_address.as_ref().expect("shipping parsed");
        assert_eq!(shipping.label.as_deref(), Some("Warehouse-A"));
        let totals = input.totals.as_ref().expect("totals parsed");
        assert_eq!(totals.sub_total, 3000.0);
        assert_eq!(totals.discount_overall, Some(100.0));
        assert_eq!(totals.total, 2900.0);
        let attachments = input.attachments.as_ref().expect("attachments parsed");
        assert_eq!(attachments.len(), 1);
        assert_eq!(attachments[0].name.as_deref(), Some("scope.pdf"));
        assert_eq!(attachments[0].size, Some(1024));
        assert_eq!(input.status.as_deref(), Some("sent"));
    }

    /// Legacy bodies (no G1/G2 fields) must keep deserialising — every
    /// new field is `#[serde(default)]`.
    #[test]
    fn create_input_g1_g2_fields_default_to_none() {
        let json = serde_json::json!({
            "quotationNo": "QT-1",
            "date": "2026-05-01T00:00:00Z",
            "validUntil": "2026-05-31T00:00:00Z",
            "clientId": "507f1f77bcf86cd799439011",
            "currency": "INR",
            "items": [],
        });
        let input: CreateQuotationInput = serde_json::from_value(json).unwrap();
        assert!(input.reference_no.is_none());
        assert!(input.sales_agent_id.is_none());
        assert!(input.deal_id.is_none());
        assert!(input.exchange_rate.is_none());
        assert!(input.billing_address.is_none());
        assert!(input.shipping_address.is_none());
        assert!(input.totals.is_none());
        assert!(input.attachments.is_none());
        assert!(input.status.is_none());
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

    /// Each new G1/G2 patch field must individually defeat `is_empty()`
    /// — otherwise a totals-only (etc.) PATCH would 400.
    #[test]
    fn update_input_is_empty_sees_g1_g2_fields() {
        let cases: Vec<UpdateQuotationInput> = vec![
            UpdateQuotationInput {
                totals: Some(Totals::default()),
                ..Default::default()
            },
            UpdateQuotationInput {
                attachments: Some(vec![]),
                ..Default::default()
            },
            UpdateQuotationInput {
                exchange_rate: Some(1.0),
                ..Default::default()
            },
            UpdateQuotationInput {
                reference_no: Some("REF-1".into()),
                ..Default::default()
            },
            UpdateQuotationInput {
                sales_agent_id: Some("507f1f77bcf86cd799439033".into()),
                ..Default::default()
            },
            UpdateQuotationInput {
                deal_id: Some("507f1f77bcf86cd799439044".into()),
                ..Default::default()
            },
            UpdateQuotationInput {
                billing_address: Some(Address::default()),
                ..Default::default()
            },
            UpdateQuotationInput {
                shipping_address: Some(Address::default()),
                ..Default::default()
            },
        ];
        for (i, case) in cases.iter().enumerate() {
            assert!(!case.is_empty(), "case {i} should not be empty");
        }
    }

    /// G1/G2 patch fields round-trip from camelCase JSON.
    #[test]
    fn update_input_round_trips_g1_g2_fields() {
        let json = serde_json::json!({
            "totals": { "subTotal": 500.0, "total": 500.0 },
            "attachments": [ { "fileId": "507f1f77bcf86cd799439055" } ],
            "exchangeRate": 82.0,
            "referenceNo": "REF-2",
            "salesAgentId": "507f1f77bcf86cd799439033",
            "dealId": "507f1f77bcf86cd799439044",
            "billingAddress": { "city": "Pune" },
            "shippingAddress": { "city": "Nagpur" },
        });
        let patch: UpdateQuotationInput = serde_json::from_value(json).unwrap();
        assert_eq!(patch.totals.as_ref().map(|t| t.total), Some(500.0));
        assert_eq!(patch.attachments.as_ref().map(Vec::len), Some(1));
        assert_eq!(patch.exchange_rate, Some(82.0));
        assert_eq!(patch.reference_no.as_deref(), Some("REF-2"));
        assert_eq!(
            patch.billing_address.as_ref().and_then(|a| a.city.as_deref()),
            Some("Pune")
        );
        assert_eq!(
            patch
                .shipping_address
                .as_ref()
                .and_then(|a| a.city.as_deref()),
            Some("Nagpur")
        );
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
