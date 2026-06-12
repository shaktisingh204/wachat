//! Wire-format request DTOs for the payout endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_purchases_types::PayoutReceipt`] DTO — we deliberately do not
//! redeclare it here. The shapes below describe only what callers send IN
//! (create-input, update-input, list-query); they are intentionally
//! narrower than the full PayoutReceipt model so the API surface stays
//! controlled.
//!
//! Field naming matches the existing TS server action
//! `src/app/actions/crm-payouts.actions.ts` and the `PayoutReceipt`
//! struct in `crm-purchases-types::payout_receipt`. All structs use
//! `#[serde(rename_all = "camelCase")]` so JSON requests round-trip with
//! the TS clients.

use crm_purchases_types::{BillApplication, PayoutStatus};
use crm_sales_types::PaymentMode;
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/payouts` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across the
/// fields most likely to identify a payout at a glance: `paymentNo`,
/// `txnId`, `chequeNo`, and `reference`. `vendorId` and `status` narrow
/// further when supplied.
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
    /// Free-text search.
    #[serde(default)]
    pub q: Option<String>,
    /// Restrict to payouts paid to a single vendor (24-char hex).
    #[serde(default)]
    pub vendor_id: Option<String>,
    /// Restrict to a single workflow status. Lower-case to match the
    /// stored enum (`"sent"`, `"cleared"`, `"failed"`).
    #[serde(default)]
    pub status: Option<String>,
    /// SabCRM (project) mounts only — required there, ignored on legacy.
    #[serde(default)]
    pub project_id: Option<String>,
}

/// Scope carrier for get/update/delete on SabCRM (project) mounts —
/// `?projectId=<oid>`. Ignored on the legacy (`userId`) mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `POST /v1/crm/payouts` body. Curated subset of the full
/// [`crm_purchases_types::PayoutReceipt`] fields — enough to drive the
/// existing "Record Payout" UI without exposing the heavy
/// attribution/audit surface (those are stamped server-side).
///
/// **Required:** `paymentNo`, `date`, `vendorId`, `mode`,
/// `bankAccountId`, `amount`, `currency`.
///
/// **Optional:** `chequeNo`, `chequeDate`, `txnId`, `reference`,
/// `applyTo[]`, `excessAsAdvance`, `tdsDeducted`, `notes`, plus
/// forward-compat lineage hooks (`fromKind`, `fromId`).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePayoutInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- doc number + dates (★ required) ----- */
    /// Human-readable payout number (e.g. "PAY-2026-0001").
    pub payment_no: String,
    /// ISO-8601 datetime — when the payout was issued.
    pub date: chrono::DateTime<chrono::Utc>,

    /* ----- parties + accounts (★ required) ----- */
    /// 24-char hex of the vendor receiving the payout.
    pub vendor_id: String,
    /// Payment rail used (cash / cheque / upi / neft / rtgs / imps /
    /// card / wallet). Lower-case enum on the wire.
    pub mode: PaymentMode,
    /// 24-char hex into `crm_payment_accounts` — the bank/UPI/wallet
    /// account the money was paid out from.
    pub bank_account_id: String,

    /* ----- mode-specific details ----- */
    #[serde(default)]
    pub cheque_no: Option<String>,
    #[serde(default)]
    pub cheque_date: Option<chrono::DateTime<chrono::Utc>>,
    /// UPI/NEFT/RTGS/IMPS/card transaction id.
    #[serde(default)]
    pub txn_id: Option<String>,
    /// Optional human reference ("Q3 retainer", vendor's invoice ref…).
    #[serde(default)]
    pub reference: Option<String>,

    /* ----- amounts (★ required: amount + currency) ----- */
    pub amount: f64,
    /// ISO-4217 code.
    pub currency: String,

    /* ----- allocation ----- */
    /// Per-bill allocation. When non-empty AND `fromId` is absent, the
    /// lineage seeds from the FIRST bill in this list (mirrors §G7).
    #[serde(default)]
    pub apply_to: Vec<BillApplication>,
    /// Park the unallocated remainder as a vendor advance.
    #[serde(default)]
    pub excess_as_advance: bool,

    /* ----- adjustments ----- */
    /// TDS we deducted at source from the vendor's payable. Booked to
    /// the TDS payable ledger downstream.
    #[serde(default)]
    pub tds_deducted: Option<f64>,

    /* ----- doc body ----- */
    #[serde(default)]
    pub notes: Option<String>,

    /* ----- lineage hooks ----- */
    /// Logical kind of the parent record this payout was created FROM.
    /// Today only `"bill"` is honoured; other values are accepted but
    /// ignored.
    #[serde(default)]
    pub from_kind: Option<String>,
    /// 24-char hex of the parent record. When absent and `applyTo[]` is
    /// non-empty, the lineage seeds from `applyTo[0].billId` instead.
    #[serde(default)]
    pub from_id: Option<String>,
}

/// `PATCH /v1/crm/payouts/:payoutId` body. Every field is optional; only
/// the fields explicitly sent are modified on the document. The handler
/// always refreshes `updatedAt` regardless of which fields are set.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePayoutInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<chrono::DateTime<chrono::Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<PaymentMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_account_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cheque_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cheque_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub txn_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub apply_to: Option<Vec<BillApplication>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub excess_as_advance: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_deducted: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<PayoutStatus>,
}

impl UpdatePayoutInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.payment_no.is_none()
            && self.date.is_none()
            && self.vendor_id.is_none()
            && self.mode.is_none()
            && self.bank_account_id.is_none()
            && self.cheque_no.is_none()
            && self.cheque_date.is_none()
            && self.txn_id.is_none()
            && self.reference.is_none()
            && self.amount.is_none()
            && self.currency.is_none()
            && self.apply_to.is_none()
            && self.excess_as_advance.is_none()
            && self.tds_deducted.is_none()
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
            "paymentNo": "PAY-2026-0001",
            "date": "2026-05-07T10:00:00Z",
            "vendorId": "65f000000000000000000001",
            "mode": "neft",
            "bankAccountId": "65f000000000000000000002",
            "amount": 50000.0,
            "currency": "INR",
            "txnId": "NEFT-9988",
            "applyTo": [
                { "billId": "65f000000000000000000003", "amount": 30000.0 },
                { "billId": "65f000000000000000000004", "amount": 20000.0 },
            ],
            "excessAsAdvance": false,
            "tdsDeducted": 5000.0,
        });
        let input: CreatePayoutInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.payment_no, "PAY-2026-0001");
        assert_eq!(input.amount, 50_000.0);
        assert_eq!(input.currency, "INR");
        assert_eq!(input.txn_id.as_deref(), Some("NEFT-9988"));
        assert_eq!(input.apply_to.len(), 2);
        assert_eq!(input.apply_to[0].amount, 30_000.0);
        assert_eq!(input.tds_deducted, Some(5_000.0));
        assert!(matches!(input.mode, PaymentMode::Neft));
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdatePayoutInput::default();
        assert!(empty.is_empty());

        let with_field = UpdatePayoutInput {
            status: Some(PayoutStatus::Cleared),
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
    fn list_query_parses_filters() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({
            "page": 2,
            "limit": 50,
            "q": "NEFT",
            "vendorId": "65f000000000000000000001",
            "status": "cleared",
        }))
        .unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.limit, Some(50));
        assert_eq!(q.q.as_deref(), Some("NEFT"));
        assert_eq!(q.vendor_id.as_deref(), Some("65f000000000000000000001"));
        assert_eq!(q.status.as_deref(), Some("cleared"));
    }
}
