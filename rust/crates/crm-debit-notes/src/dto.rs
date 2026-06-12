//! Wire-format request DTOs for the debit-note endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_purchases_types::DebitNote`] — we deliberately do not redeclare
//! it here. The shapes below describe only what callers send IN
//! (create-input, update-input, list-query); they are intentionally
//! narrower than the full DebitNote model so the API surface stays
//! controlled.
//!
//! Field naming matches `src/app/actions/crm-debit-notes.actions.ts`
//! and the [`DebitNote`](crm_purchases_types::DebitNote) struct in
//! `crm-purchases-types::debit_note`. All structs use
//! `#[serde(rename_all = "camelCase")]` so JSON requests round-trip
//! with the TS clients.
//!
//! ## Pass-through fields (`items`, `totals`, `refundMode`)
//!
//! `items` / `totals` / `refundMode` are typed on the canonical
//! [`DebitNote`](crm_purchases_types::DebitNote) struct (`Vec<LineItem>`,
//! `Totals`, `RefundMode` — all owned by `crm-sales-types`). To avoid
//! pulling `crm-sales-types` into this crate's surface for the input DTO
//! we accept those fields as opaque [`serde_json::Value`] on the wire
//! and round-trip them through `bson::to_bson` at insert time. Mongo
//! (re)serializes via the canonical struct on read so the wire format
//! stays identical end-to-end.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/debit-notes` query string.
///
/// `q` is a free-text substring searched (case-insensitive) against
/// `dnNo` — the human-facing document number — to mirror the legacy TS
/// list filter. Additional structured filters narrow further.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** when
    /// the router is mounted in `ScopeMode::Project` (the
    /// `/v1/sabcrm/finance/debit-notes` mount); ignored on the legacy
    /// `userId`-scoped `/v1/crm/debit-notes` mount.
    #[serde(default)]
    pub project_id: Option<String>,
    /// 1-indexed page (matches TS). Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to
    /// [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text search on `dnNo`.
    #[serde(default)]
    pub q: Option<String>,
    /// Restrict to a single vendor (24-char hex `ObjectId`).
    #[serde(default)]
    pub vendor_id: Option<String>,
    /// Restrict to a single workflow status — `draft` / `issued` /
    /// `refunded` / `cancelled`. Compared case-insensitively.
    #[serde(default)]
    pub status: Option<String>,
}

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{debitNoteId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project`, ignored on the legacy
/// `userId`-scoped mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`).
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `POST /v1/crm/debit-notes` body. Curated subset of the full
/// [`DebitNote`](crm_purchases_types::DebitNote) — required fields are
/// `dnNo`, `date`, `vendorId`, `reason`, `currency`, `items[]`,
/// `totals`, `refundMode`. Optional: `linkedBillId`, `refundTxnId`,
/// `notes`. Identity (`projectId`/`userId`/`tenantId`), audit
/// (`createdAt` / `createdBy`), workflow `status`, attachments, and
/// `lineage[]` are stamped server-side.
///
/// `fromKind` + `fromId` are the §13.5 lineage seeds (G6 pattern):
/// allowed parent kinds are `"bill"` and `"purchaseOrder"` only.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDebitNoteInput {
    /* ----- identity (optional override) -------------------------- */
    /// Optional project scope. When absent the create handler stamps a
    /// freshly-minted `ObjectId` so the document is at least
    /// syntactically valid; production callers SHOULD send the real
    /// projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- doc number + date (★ required) ------------------------ */
    pub dn_no: String,
    pub date: chrono::DateTime<chrono::Utc>,

    /* ----- parties + refs (★ required) --------------------------- */
    /// 24-char hex `ObjectId` of the vendor on `crm_vendors`.
    pub vendor_id: String,
    /// One of `return` / `discount` / `price_adjust` / `cancel` /
    /// `other`. Compared snake_case to mirror
    /// [`DebitNoteReason`](crm_purchases_types::DebitNoteReason)'s serde
    /// representation.
    pub reason: String,

    /* ----- money (★ required) ------------------------------------ */
    /// ISO-4217 currency code.
    pub currency: String,

    /* ----- line items + totals (★ required) ---------------------- */
    /// `Vec<LineItem>` shape — see module-level docs for why this is
    /// `Value` here. Empty arrays are rejected by the handler.
    #[serde(default)]
    pub items: Value,
    /// `Totals` shape — same rationale as `items`. Defaults are filled
    /// at insert time if the caller omits subfields.
    #[serde(default)]
    pub totals: Value,

    /* ----- refund handling (★ required mode) --------------------- */
    /// One of `cash` / `credit` / `replacement`. Mirrors
    /// [`RefundMode`](crm_purchases_types::debit_note) — semantics flip
    /// on the vendor side ("credit" = held against the vendor).
    pub refund_mode: String,

    /* ----- optional linkage / metadata --------------------------- */
    /// 24-char hex `ObjectId` of the source bill (when this DN is
    /// issued against a specific invoice). Standalone debit notes omit
    /// this field.
    #[serde(default)]
    pub linked_bill_id: Option<String>,
    /// Free-form transaction id from the refund processor / bank.
    #[serde(default)]
    pub refund_txn_id: Option<String>,
    /// Free-form note shown on the printed document.
    #[serde(default)]
    pub notes: Option<String>,

    /* ----- §13.5 lineage seeding (G6 pattern) -------------------- */
    /// Allowed values: `"bill"`, `"purchaseOrder"`. Anything else (or
    /// either field missing) skips the lineage seed.
    #[serde(default)]
    pub from_kind: Option<String>,
    /// Hex-encoded `ObjectId` of the parent bill / purchase order.
    #[serde(default)]
    pub from_id: Option<String>,
}

/// `PATCH /v1/crm/debit-notes/:debitNoteId` body. Every field is
/// optional; only the fields explicitly sent are modified on the
/// document. The handler always refreshes `updatedAt` (and `updatedBy`)
/// regardless of which fields are set.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDebitNoteInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dn_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<chrono::DateTime<chrono::Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub totals: Option<Value>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refund_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refund_txn_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_bill_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// Workflow transition — `draft` / `issued` / `refunded` /
    /// `cancelled`. Validated case-insensitively.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

impl UpdateDebitNoteInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.dn_no.is_none()
            && self.date.is_none()
            && self.vendor_id.is_none()
            && self.reason.is_none()
            && self.currency.is_none()
            && self.items.is_none()
            && self.totals.is_none()
            && self.refund_mode.is_none()
            && self.refund_txn_id.is_none()
            && self.linked_bill_id.is_none()
            && self.notes.is_none()
            && self.status.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "dnNo": "DN-001",
            "date": "2026-05-06T00:00:00Z",
            "vendorId": "507f1f77bcf86cd799439011",
            "reason": "return",
            "currency": "INR",
            "items": [{
                "qty": 2.0,
                "rate": 150.0,
                "total": 300.0,
            }],
            "totals": { "subTotal": 300.0, "total": 300.0 },
            "refundMode": "replacement",
            "linkedBillId": "507f1f77bcf86cd799439012",
            "fromKind": "bill",
            "fromId": "507f1f77bcf86cd799439012",
        });
        let input: CreateDebitNoteInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.dn_no, "DN-001");
        assert_eq!(input.vendor_id, "507f1f77bcf86cd799439011");
        assert_eq!(input.reason, "return");
        assert_eq!(input.currency, "INR");
        assert_eq!(input.refund_mode, "replacement");
        assert_eq!(
            input.linked_bill_id.as_deref(),
            Some("507f1f77bcf86cd799439012")
        );
        assert_eq!(input.from_kind.as_deref(), Some("bill"));
        assert!(input.items.is_array());
        assert!(input.totals.is_object());
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateDebitNoteInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateDebitNoteInput {
            status: Some("issued".into()),
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
    fn list_query_accepts_filters() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({
            "page": 2,
            "limit": 50,
            "q": "DN-001",
            "vendorId": "507f1f77bcf86cd799439011",
            "status": "issued",
        }))
        .unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.limit, Some(50));
        assert_eq!(q.q.as_deref(), Some("DN-001"));
        assert_eq!(q.vendor_id.as_deref(), Some("507f1f77bcf86cd799439011"));
        assert_eq!(q.status.as_deref(), Some("issued"));
    }
}
