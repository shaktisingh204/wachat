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
use crm_core::Attachment;
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
/// **Financial fields** (`amount`, `mode`, `applyTo`, `clientId`,
/// `currency`, `exchangeRate`, `excessAsAdvance`) ARE patchable here
/// (finance-rollout gap G4 — the previous "void+recreate" contract is
/// gone). Reconciling paid-amount mutations on linked invoices stays
/// the **action layer's** responsibility: the Next.js action that
/// patches `amount`/`applyTo` re-runs the invoice status flip the same
/// way `recordSabcrmInvoicePayment` does on create.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePaymentReceiptInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub receipt_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_account_id: Option<String>,

    /* ----- parties + mode (G4) ----- */
    /// Re-point the receipt at a different client (24-char hex).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    /// Change the payment mode (`cash`/`cheque`/`upi`/…).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<PaymentMode>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cheque_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cheque_date: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub txn_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,

    /* ----- amounts (G4) ----- */
    /// New receipt amount. Must be a positive finite number.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    /// Must be a positive finite number when present.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exchange_rate: Option<f64>,

    /* ----- allocation (G4) ----- */
    /// Full replacement of the allocation table. Sending `[]` clears
    /// all allocations.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub apply_to: Option<Vec<InvoiceApplication>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub excess_as_advance: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_deducted: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_charges: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    /// Full replacement of the attachments array (SabFiles pointers).
    /// Sending `[]` clears all attachments.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Attachment>>,
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
            && self.client_id.is_none()
            && self.mode.is_none()
            && self.cheque_no.is_none()
            && self.cheque_date.is_none()
            && self.txn_id.is_none()
            && self.reference.is_none()
            && self.amount.is_none()
            && self.currency.is_none()
            && self.exchange_rate.is_none()
            && self.apply_to.is_none()
            && self.excess_as_advance.is_none()
            && self.tds_deducted.is_none()
            && self.bank_charges.is_none()
            && self.notes.is_none()
            && self.attachments.is_none()
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

    /// G4 — the PATCH body now accepts the financial fields the spec
    /// flagged as un-patchable: `amount`, `mode`, `applyTo`, `clientId`
    /// (+ `currency`, `exchangeRate`, `excessAsAdvance`, `attachments`).
    #[test]
    fn update_input_round_trips_g4_financial_fields() {
        let json = serde_json::json!({
            "amount": 9999.5,
            "mode": "cheque",
            "clientId": "65b0a0a0a0a0a0a0a0a0a0a9",
            "currency": "INR",
            "exchangeRate": 1.0,
            "applyTo": [
                { "invoiceId": "65b0a0a0a0a0a0a0a0a0a0a2", "amount": 5000.0 },
                { "invoiceId": "65b0a0a0a0a0a0a0a0a0a0a3", "amount": 4999.5 },
            ],
            "excessAsAdvance": true,
            "attachments": [
                { "fileId": "65b0a0a0a0a0a0a0a0a0a0a4", "name": "advice.pdf" }
            ],
        });
        let p: UpdatePaymentReceiptInput = serde_json::from_value(json).unwrap();
        assert_eq!(p.amount, Some(9999.5));
        assert_eq!(p.mode, Some(PaymentMode::Cheque));
        assert_eq!(p.client_id.as_deref(), Some("65b0a0a0a0a0a0a0a0a0a0a9"));
        assert_eq!(p.currency.as_deref(), Some("INR"));
        assert_eq!(p.exchange_rate, Some(1.0));
        let apply_to = p.apply_to.as_ref().expect("applyTo parsed");
        assert_eq!(apply_to.len(), 2);
        assert_eq!(apply_to[1].amount, 4999.5);
        assert_eq!(p.excess_as_advance, Some(true));
        assert_eq!(p.attachments.as_ref().map(Vec::len), Some(1));
    }

    /// G4 — each financial field must individually defeat `is_empty()`.
    #[test]
    fn update_input_is_empty_sees_g4_fields() {
        let cases: Vec<UpdatePaymentReceiptInput> = vec![
            UpdatePaymentReceiptInput {
                amount: Some(1.0),
                ..Default::default()
            },
            UpdatePaymentReceiptInput {
                mode: Some(PaymentMode::Cash),
                ..Default::default()
            },
            UpdatePaymentReceiptInput {
                client_id: Some("65b0a0a0a0a0a0a0a0a0a0a9".into()),
                ..Default::default()
            },
            UpdatePaymentReceiptInput {
                apply_to: Some(vec![]),
                ..Default::default()
            },
            UpdatePaymentReceiptInput {
                excess_as_advance: Some(false),
                ..Default::default()
            },
            UpdatePaymentReceiptInput {
                currency: Some("INR".into()),
                ..Default::default()
            },
            UpdatePaymentReceiptInput {
                exchange_rate: Some(83.0),
                ..Default::default()
            },
            UpdatePaymentReceiptInput {
                attachments: Some(vec![]),
                ..Default::default()
            },
        ];
        for (i, case) in cases.iter().enumerate() {
            assert!(!case.is_empty(), "case {i} should not be empty");
        }
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
