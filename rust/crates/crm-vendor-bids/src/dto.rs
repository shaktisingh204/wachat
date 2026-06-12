//! Wire-format request DTOs for the vendor-bid endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_extras_types::VendorBid`] DTO — we deliberately do not
//! redeclare it here. The shapes below describe only what callers send
//! IN (create-input, update-input, list-query); they are intentionally
//! narrower than the full VendorBid model so the API surface stays
//! controlled.
//!
//! Field naming matches the §12.3 spec in `crm_function_plan.md` and
//! the `VendorBid` struct in `crm-extras-types::rfq`. All structs use
//! `#[serde(rename_all = "camelCase")]` so JSON requests round-trip
//! with the TS clients.
//!
//! ## items / totals / attachments
//!
//! `items[]`, `totals`, and `attachments[]` round-trip as raw
//! `serde_json::Value` here — the wire shape mirrors the
//! `BidLineItem` / `Totals` / `Attachment` structs from `crm-extras-
//! types` and `crm-core`, but we keep this crate decoupled by passing
//! through verbatim. The handler converts each `Value` into `Bson` via
//! `bson::to_bson` at insert time so any structure that round-trips
//! through serde_json works.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/vendor-bids` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across the
/// fields most likely to identify a bid at a glance: `vendorName` (the
/// optional cached label) and `terms`. `rfqId`, `vendorId`, and
/// `status` narrow further.
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
    /// Free-text search across `vendorName` + `terms`.
    #[serde(default)]
    pub q: Option<String>,
    /// Restrict to a single parent RFQ (24-char hex).
    #[serde(default)]
    pub rfq_id: Option<String>,
    /// Restrict to a single vendor (24-char hex).
    #[serde(default)]
    pub vendor_id: Option<String>,
    /// Restrict to a workflow status — one of the lower-case
    /// [`crm_extras_types::BidStatus`] variants ("submitted",
    /// "shortlisted", "awarded", "rejected", "withdrawn").
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

/// `POST /v1/crm/vendor-bids` body. Required: `rfqId`, `vendorId`,
/// `items[]`, `currency`. Everything else is optional.
///
/// **Lineage:** `rfqId` IS the lineage parent — there is no `fromKind`
/// switch like on Purchase Orders. The handler resolves the parent
/// RFQ under the same `userId` scope and seeds `lineage[]`
/// automatically.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVendorBidInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- references (★ both required) ----- */
    /// 24-char hex of the parent RFQ. Required — every bid is scoped
    /// to exactly one RFQ.
    pub rfq_id: String,
    /// 24-char hex of the responding vendor. Required.
    pub vendor_id: String,

    /* ----- priced response (★ items + currency required) ----- */
    /// Line-items array. Each element should round-trip into the
    /// `BidLineItem` shape from `crm-extras-types::rfq`. Stored
    /// verbatim via `bson::to_bson`. Must contain at least one row.
    pub items: Vec<Value>,
    /// Document-level totals. Should round-trip into `Totals` from
    /// `crm-sales-types::line_item`. Optional — defaults to `{}` if
    /// absent (vendors quoting per-line only).
    #[serde(default)]
    pub totals: Option<Value>,
    /// ISO-4217 code. No default — the caller MUST be explicit so
    /// multi-currency vendors don't accidentally fall back.
    pub currency: String,

    /* ----- doc body ----- */
    #[serde(default)]
    pub terms: Option<String>,
    /// Attachment array — each element should round-trip into
    /// `crm_core::Attachment` (a SabFiles `fileId` + cached label /
    /// mime / size). Per the project's "every file lives in SabFiles"
    /// policy, raw URLs are forbidden — the UI must resolve files via
    /// the SabFile picker components before sending.
    #[serde(default)]
    pub attachments: Option<Vec<Value>>,

    /* ----- denormalized cache for back-link / display ----- */
    /// Optional human label for the vendor at submit time. Persisted
    /// as `vendorName` on the document so list views can render
    /// "<Vendor> — <currency> <total>" without a per-row `$lookup`.
    /// Refresh manually if the vendor record is renamed (rare).
    ///
    /// Note: the back-link onto the parent RFQ's `lineage[]` stores
    /// only `{ kind: "vendorBid", id }` — `vendorName` is not part of
    /// the lineage protocol.
    #[serde(default)]
    pub vendor_name: Option<String>,
}

/// `PATCH /v1/crm/vendor-bids/:bidId` body. Every field is optional;
/// only the fields explicitly sent are modified on the document. The
/// handler always refreshes `updatedAt` regardless of which fields are
/// set.
///
/// **NOT updatable here:** `rfqId` (re-parenting a bid would corrupt
/// the procurement audit trail — withdraw + resubmit instead),
/// `vendorId` (likewise — vendor identity is part of the bid record),
/// `lineage` (server-managed via [`crate::handlers::create_vendor_bid`]
/// and the award cascade), `submittedAt` (immutable timestamp).
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateVendorBidInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub totals: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Value>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_name: Option<String>,

    /// Workflow status — one of the lower-case
    /// [`crm_extras_types::BidStatus`] variants. Flipping to
    /// `"awarded"` triggers a best-effort cascade on the parent RFQ
    /// — see [`crate::handlers::update_vendor_bid`].
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

impl UpdateVendorBidInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.items.is_none()
            && self.totals.is_none()
            && self.currency.is_none()
            && self.terms.is_none()
            && self.attachments.is_none()
            && self.vendor_name.is_none()
            && self.status.is_none()
    }
}

/// Lower-case workflow status strings accepted on `ListQuery::status`
/// and `UpdateVendorBidInput::status`. Mirrors the
/// `#[serde(rename_all = "lowercase")]` representation of
/// [`crm_extras_types::BidStatus`].
pub const ALLOWED_STATUSES: &[&str] = &[
    "submitted",
    "shortlisted",
    "awarded",
    "rejected",
    "withdrawn",
];

/// Lower-case status strings accepted on the parent RFQ during the
/// award cascade. Mirrors [`crm_extras_types::RfqStatus`]. Exposed for
/// the test that verifies the cascade target string is legal.
pub const ALLOWED_RFQ_STATUSES: &[&str] = &["draft", "open", "closed", "awarded", "cancelled"];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "rfqId": "507f1f77bcf86cd799439011",
            "vendorId": "507f1f77bcf86cd799439012",
            "items": [
                { "qty": 100.0, "rate": 219.5, "leadTimeDays": 7 }
            ],
            "currency": "INR",
            "terms": "Net-30",
            "vendorName": "Acme Stationery",
        });
        let input: CreateVendorBidInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.rfq_id, "507f1f77bcf86cd799439011");
        assert_eq!(input.vendor_id, "507f1f77bcf86cd799439012");
        assert_eq!(input.currency, "INR");
        assert_eq!(input.items.len(), 1);
        assert_eq!(input.terms.as_deref(), Some("Net-30"));
        assert_eq!(input.vendor_name.as_deref(), Some("Acme Stationery"));
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateVendorBidInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateVendorBidInput {
            status: Some("awarded".into()),
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
        assert!(q.rfq_id.is_none());
        assert!(q.vendor_id.is_none());
        assert!(q.status.is_none());
    }

    #[test]
    fn list_query_round_trips_filters() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({
            "page": 2,
            "limit": 50,
            "q": "stationery",
            "rfqId": "507f1f77bcf86cd799439011",
            "vendorId": "507f1f77bcf86cd799439012",
            "status": "shortlisted",
        }))
        .unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.limit, Some(50));
        assert_eq!(q.q.as_deref(), Some("stationery"));
        assert_eq!(q.rfq_id.as_deref(), Some("507f1f77bcf86cd799439011"));
        assert_eq!(q.status.as_deref(), Some("shortlisted"));
    }

    #[test]
    fn allowed_statuses_covers_all_variants() {
        // If a new variant is added to BidStatus, this test should be
        // updated too — keep the list in sync.
        assert_eq!(ALLOWED_STATUSES.len(), 5);
        assert!(ALLOWED_STATUSES.contains(&"submitted"));
        assert!(ALLOWED_STATUSES.contains(&"awarded"));
        assert!(ALLOWED_STATUSES.contains(&"withdrawn"));
    }

    #[test]
    fn allowed_rfq_statuses_includes_award_target() {
        // The cascade flips RFQ → "awarded"; verify it's a legal value.
        assert!(ALLOWED_RFQ_STATUSES.contains(&"awarded"));
    }
}
