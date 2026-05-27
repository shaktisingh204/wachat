//! Wire-format request DTOs for the §1.8 credit-note endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_sales_types::CreditNote`] DTO — we deliberately do not
//! redeclare it here. The shapes below describe only what callers send
//! IN (create-input, update-input, list-query); they are intentionally
//! narrower than the full `CreditNote` model so the API surface stays
//! controlled.
//!
//! Field naming matches the existing TS server action
//! `src/app/actions/crm-credit-notes.actions.ts` and the `CreditNote`
//! struct in `crm-sales-types::credit_note`. All structs use
//! `#[serde(rename_all = "camelCase")]` so JSON requests round-trip
//! with the TS clients.

use crm_sales_types::{CreditNoteReason, CreditNoteStatus, RefundMode};
use crm_sales_types::line_item::{LineItem, Totals};
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/credit-notes` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across the
/// fields most likely to identify a credit note at a glance: `cnNo` and
/// `notes`. `clientId` / `status` narrow further.
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
    /// Free-text search across `cnNo` and `notes`.
    #[serde(default)]
    pub q: Option<String>,
    /// Restrict to a single client (24-char hex ObjectId).
    #[serde(default)]
    pub client_id: Option<String>,
    /// Restrict to a single workflow status (`draft` / `issued` /
    /// `refunded` / `cancelled`).
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /v1/crm/credit-notes` body. The endpoint accepts a curated
/// subset of the full [`crm_sales_types::CreditNote`] fields — enough to
/// drive the existing "Add Credit Note" UI without exposing the heavy
/// cross-cutting `Identity` / `Audit` / `Assignment` surface (those are
/// stamped server-side from the authenticated principal).
///
/// **Required:** `cnNo`, `date`, `clientId`, `reason`, `currency`,
/// `items`, `totals`, `refundMode`.
///
/// **Optional:** `linkedInvoiceId`, `taxRecalc`, `refundTxnId`, `notes`,
/// plus the `fromKind` / `fromId` lineage hooks (§13.5 — only `invoice`
/// is currently allow-listed as a parent kind).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCreditNoteInput {
    /* ----- doc number + dates (★ required) ----- */
    /// Human-readable credit-note number (e.g. `"CN-00001"`). The
    /// caller is responsible for sequence allocation; the handler does
    /// no auto-numbering (parity with the typed `crm-sales-types`
    /// shape — sequence logic stays in TS until a dedicated numbering
    /// crate lands).
    pub cn_no: String,
    pub date: chrono::DateTime<chrono::Utc>,

    /* ----- parties + refs (★ client_id required) ----- */
    /// 24-char hex of the client this credit note is issued to.
    pub client_id: String,
    /// Optional source invoice (24-char hex). Standalone credit notes
    /// (issued without a prior invoice — e.g. goodwill credit) are
    /// allowed when this is absent.
    #[serde(default)]
    pub linked_invoice_id: Option<String>,

    /// Why the credit note was issued (return / discount / price-adjust
    /// / cancel / other). Maps onto
    /// [`crm_sales_types::CreditNoteReason`].
    pub reason: CreditNoteReason,

    /* ----- money settings (★ currency required) ----- */
    /// ISO-4217 currency code.
    pub currency: String,

    /* ----- line items + totals (★ both required) ----- */
    pub items: Vec<LineItem>,
    pub totals: Totals,

    /* ----- recalculation knob ----- */
    /// `true` ⇒ recompute taxes from line-item rates rather than
    /// inheriting the source invoice's tax breakdown verbatim.
    #[serde(default)]
    pub tax_recalc: Option<bool>,

    /* ----- refund handling (★ refund_mode required) ----- */
    pub refund_mode: RefundMode,
    /// Bank/UPI txn id when `refundMode == cash`. Optional in all
    /// other modes.
    #[serde(default)]
    pub refund_txn_id: Option<String>,
    #[serde(default)]
    pub auto_apply: Option<bool>,

    /* ----- doc body ----- */
    #[serde(default)]
    pub notes: Option<String>,

    /* ----- forward-compat lineage hooks (§13.5) ----- */
    /// Logical kind of the parent record this credit note was created
    /// FROM. Only `"invoice"` is currently allow-listed (the TS action
    /// gates this against `ALLOWED_PARENT_KINDS = ['invoice']`).
    #[serde(default)]
    pub from_kind: Option<String>,
    /// 24-char hex of the parent record.
    #[serde(default)]
    pub from_id: Option<String>,
    
    #[serde(default)]
    pub design_metadata: Option<serde_json::Value>,
}

/// `PATCH /v1/crm/credit-notes/:cnId` body. Every field is optional;
/// only the fields explicitly sent are modified on the document. The
/// handler always refreshes `updatedAt` regardless of which fields are
/// set.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCreditNoteInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cn_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<chrono::DateTime<chrono::Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_invoice_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<CreditNoteReason>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<LineItem>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub totals: Option<Totals>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_recalc: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refund_mode: Option<RefundMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refund_txn_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_apply: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<CreditNoteStatus>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design_metadata: Option<serde_json::Value>,
}

impl UpdateCreditNoteInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.cn_no.is_none()
            && self.date.is_none()
            && self.client_id.is_none()
            && self.linked_invoice_id.is_none()
            && self.reason.is_none()
            && self.currency.is_none()
            && self.items.is_none()
            && self.totals.is_none()
            && self.tax_recalc.is_none()
            && self.refund_mode.is_none()
            && self.refund_txn_id.is_none()
            && self.auto_apply.is_none()
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
            "cnNo": "CN-00007",
            "date": "2026-04-01T00:00:00Z",
            "clientId": "507f1f77bcf86cd799439011",
            "linkedInvoiceId": "507f1f77bcf86cd799439012",
            "reason": "return",
            "currency": "INR",
            "items": [],
            "totals": { "subTotal": 0.0, "total": 0.0 },
            "taxRecalc": true,
            "refundMode": "cash",
            "refundTxnId": "TXN-123",
            "notes": "Customer return — DOA unit.",
            "fromKind": "invoice",
            "fromId": "507f1f77bcf86cd799439012",
        });
        let input: CreateCreditNoteInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.cn_no, "CN-00007");
        assert_eq!(input.client_id, "507f1f77bcf86cd799439011");
        assert_eq!(
            input.linked_invoice_id.as_deref(),
            Some("507f1f77bcf86cd799439012"),
        );
        assert_eq!(input.reason, CreditNoteReason::Return);
        assert_eq!(input.currency, "INR");
        assert_eq!(input.tax_recalc, Some(true));
        assert_eq!(input.refund_mode, RefundMode::Cash);
        assert_eq!(input.refund_txn_id.as_deref(), Some("TXN-123"));
        assert_eq!(input.from_kind.as_deref(), Some("invoice"));
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateCreditNoteInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateCreditNoteInput {
            status: Some(CreditNoteStatus::Issued),
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
    fn list_query_accepts_filters() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({
            "page": 2,
            "limit": 50,
            "q": "CN-000",
            "clientId": "507f1f77bcf86cd799439011",
            "status": "issued",
        }))
        .unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.limit, Some(50));
        assert_eq!(q.q.as_deref(), Some("CN-000"));
        assert_eq!(
            q.client_id.as_deref(),
            Some("507f1f77bcf86cd799439011"),
        );
        assert_eq!(q.status.as_deref(), Some("issued"));
    }
}
