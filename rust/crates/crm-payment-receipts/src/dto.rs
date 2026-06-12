//! Wire-format request DTOs for the payment-receipt endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_sales_types::PaymentReceipt`] DTO — we deliberately do not
//! redeclare it here. The shapes below describe only what callers send
//! IN (create-input, update-input, list-query); they are intentionally
//! narrower than the full PaymentReceipt model so the API surface stays
//! controlled.
//!
//! Field naming matches the existing TS server action
//! `src/app/actions/crm-payment-receipts.actions.ts` and the
//! `PaymentReceipt` struct in `crm-sales-types::payment_receipt`. All
//! structs use `#[serde(rename_all = "camelCase")]` so JSON requests
//! round-trip with the TS clients.

use chrono::{DateTime, Utc};
use crm_sales_types::{InvoiceApplication, PaymentMode, ReceiptStatus};
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/payment-receipts` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across
/// `receiptNo`, `reference`, `txnId`, and `chequeNo` — the fields most
/// likely to identify a receipt at a glance. `clientId` and `status`
/// narrow the result further.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** when
    /// the router is mounted in `ScopeMode::Project` (the
    /// `/v1/sabcrm/finance/payment-receipts` mount); ignored on the
    /// legacy `userId`-scoped `/v1/crm/payment-receipts` mount.
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
    /// Restrict to receipts for a single client (24-char hex).
    #[serde(default)]
    pub client_id: Option<String>,
    /// Restrict to a workflow status — `received` | `cleared` |
    /// `bounced`. Case-insensitive.
    #[serde(default)]
    pub status: Option<String>,
}

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{receiptId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project`, ignored on the legacy
/// `userId`-scoped mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`).
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `POST /v1/crm/payment-receipts` body. The endpoint accepts a curated
/// subset of the full [`crm_sales_types::PaymentReceipt`] fields —
/// enough to drive the existing "Record Payment" UI without exposing
/// the heavy attribution / activity-log surface.
///
/// **Required:** `receiptNo`, `date`, `clientId`, `mode`,
/// `bankAccountId`, `amount`, `currency`.
///
/// **Optional, mode-specific:** `chequeNo`, `chequeDate`, `txnId`,
/// `reference`.
///
/// **Optional, allocation:** `applyTo[]`, `excessAsAdvance`.
///
/// **Optional, adjustments:** `tdsDeducted`, `bankCharges`.
///
/// **Optional, body:** `notes`.
///
/// **Forward-compat lineage hooks:** `fromKind` + `fromId` (allowed
/// kinds: `invoice`, `proforma`). When unset and `applyTo[]` is
/// non-empty, the handler implicitly uses the first invoice in
/// `applyTo[]` as the lineage parent (mirrors the TS G4 pattern).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaymentReceiptInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- doc number + dates (★ required) ----- */
    pub receipt_no: String,
    pub date: DateTime<Utc>,

    /* ----- parties + accounts (★ required) ----- */
    pub client_id: String,
    pub mode: PaymentMode,
    pub bank_account_id: String,

    /* ----- amounts (★ required) ----- */
    pub amount: f64,
    pub currency: String,

    /* ----- mode-specific details ----- */
    #[serde(default)]
    pub cheque_no: Option<String>,
    #[serde(default)]
    pub cheque_date: Option<DateTime<Utc>>,
    #[serde(default)]
    pub txn_id: Option<String>,
    #[serde(default)]
    pub reference: Option<String>,

    /* ----- allocation ----- */
    /// Per-invoice allocation rows. Sum may be less than `amount` when
    /// `excessAsAdvance` is `true`.
    #[serde(default)]
    pub apply_to: Vec<InvoiceApplication>,
    #[serde(default)]
    pub excess_as_advance: bool,

    /* ----- adjustments ----- */
    #[serde(default)]
    pub tds_deducted: Option<f64>,
    #[serde(default)]
    pub bank_charges: Option<f64>,

    /* ----- doc body ----- */
    #[serde(default)]
    pub notes: Option<String>,

    /* ----- lineage hooks ----- */
    /// Logical kind of a parent record. Allowed values: `"invoice"`,
    /// `"proforma"`. Other values are silently ignored (the handler
    /// falls through to the `applyTo[]`-implicit fallback).
    #[serde(default)]
    pub from_kind: Option<String>,
    /// 24-char hex of the parent record.
    #[serde(default)]
    pub from_id: Option<String>,
}

/// `PATCH /v1/crm/payment-receipts/:receiptId` body. Every field is
/// optional; only the fields explicitly sent are modified on the
/// document. The handler always refreshes `updatedAt` regardless of
/// which fields are set.
///
/// **Note:** financial fields (`amount`, `applyTo`, `mode`, `clientId`)
/// are intentionally NOT settable here — the TS action's contract is
/// that mutating those would require unwinding paid-amount mutations
/// on linked invoices, which is out of scope. Use a void+recreate flow
/// for amount changes.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePaymentReceiptInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub receipt_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_account_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cheque_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cheque_date: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub txn_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_deducted: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_charges: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<ReceiptStatus>,
}

impl UpdatePaymentReceiptInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.receipt_no.is_none()
            && self.date.is_none()
            && self.bank_account_id.is_none()
            && self.cheque_no.is_none()
            && self.cheque_date.is_none()
            && self.txn_id.is_none()
            && self.reference.is_none()
            && self.tds_deducted.is_none()
            && self.bank_charges.is_none()
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
            "receiptNo": "RCPT-001",
            "date": "2026-05-07T00:00:00Z",
            "clientId": "65b0a0a0a0a0a0a0a0a0a0a0",
            "mode": "upi",
            "bankAccountId": "65b0a0a0a0a0a0a0a0a0a0a1",
            "amount": 12500.0,
            "currency": "INR",
            "txnId": "TXN-99",
            "applyTo": [
                { "invoiceId": "65b0a0a0a0a0a0a0a0a0a0a2", "amount": 12500.0 },
            ],
            "excessAsAdvance": false,
            "tdsDeducted": 0.0,
        });
        let input: CreatePaymentReceiptInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.receipt_no, "RCPT-001");
        assert_eq!(input.client_id, "65b0a0a0a0a0a0a0a0a0a0a0");
        assert_eq!(input.mode, PaymentMode::Upi);
        assert_eq!(input.amount, 12500.0);
        assert_eq!(input.txn_id.as_deref(), Some("TXN-99"));
        assert_eq!(input.apply_to.len(), 1);
        assert_eq!(input.apply_to[0].amount, 12500.0);
        assert!(!input.excess_as_advance);
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdatePaymentReceiptInput::default();
        assert!(empty.is_empty());

        let with_field = UpdatePaymentReceiptInput {
            notes: Some("revised".into()),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn update_input_status_round_trips() {
        let json = serde_json::json!({ "status": "cleared" });
        let p: UpdatePaymentReceiptInput = serde_json::from_value(json).unwrap();
        assert_eq!(p.status, Some(ReceiptStatus::Cleared));
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
}
