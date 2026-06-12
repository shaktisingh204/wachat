//! Request DTOs for POS endpoints.

use serde::{Deserialize, Serialize};

use crate::types::{CrmPosHold, CrmPosRefund, CrmPosSession, CrmPosTransaction, PosLineItem};

// ─── Shared inputs ─────────────────────────────────────────────────────────

/// Scope-only query for id-addressed routes (`GET`/`PATCH`/`DELETE`,
/// and the `POST` lifecycle verbs that carry a body). `projectId` is
/// required on SabCRM (project) mounts and ignored on legacy mounts.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosLineItemInput {
    #[serde(default)]
    pub item_id: Option<String>,
    pub name: String,
    pub quantity: f64,
    pub rate: f64,
    #[serde(default)]
    pub tax_rate: f64,
    #[serde(default)]
    pub total: Option<f64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosPaymentSplitInput {
    pub method: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefundedLineItemInput {
    pub original_line_item_index: i32,
    pub quantity: f64,
    pub refund_amount: f64,
}

// ─── Sessions ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSessionsQuery {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub terminal_id: Option<String>,
    #[serde(default)]
    pub cashier_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenSessionInput {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    pub terminal_id: String,
    pub opening_cash: f64,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloseSessionInput {
    pub closing_cash: f64,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconcileSessionInput {
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionInput {
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionResponse {
    pub id: String,
    pub entity: CrmPosSession,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSessionResponse {
    pub deleted: bool,
}

// ─── Transactions ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListTransactionsQuery {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub customer_id: Option<String>,
    #[serde(default)]
    pub cashier_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTransactionInput {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    pub session_id: String,
    #[serde(default)]
    pub customer_id: Option<String>,
    #[serde(default)]
    pub line_items: Vec<PosLineItemInput>,
    pub payment_method: String,
    #[serde(default)]
    pub payment_splits: Option<Vec<PosPaymentSplitInput>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoidTransactionInput {
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefundTransactionInput {
    pub reason: String,
    #[serde(default)]
    pub refunded_line_items: Vec<RefundedLineItemInput>,
    pub refund_method: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTransactionInput {
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTransactionResponse {
    pub id: String,
    pub entity: CrmPosTransaction,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefundTransactionResponse {
    pub transaction: CrmPosTransaction,
    pub refund: CrmPosRefund,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTransactionResponse {
    pub deleted: bool,
}

// ─── Holds ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListHoldsQuery {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub customer_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHoldInput {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    pub session_id: String,
    #[serde(default)]
    pub customer_id: Option<String>,
    #[serde(default)]
    pub line_items: Vec<PosLineItemInput>,
    #[serde(default)]
    pub hold_reason: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecallHoldInput {
    /// Optional: id of the transaction this recall produced. Lets the UI
    /// link the hold to its eventual sale.
    #[serde(default)]
    pub recalled_transaction_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateHoldInput {
    #[serde(default)]
    pub hold_reason: Option<String>,
    #[serde(default)]
    pub line_items: Option<Vec<PosLineItemInput>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHoldResponse {
    pub id: String,
    pub entity: CrmPosHold,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecallHoldResponse {
    pub hold: CrmPosHold,
    pub line_items: Vec<PosLineItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteHoldResponse {
    pub deleted: bool,
}

// ─── Refunds ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListRefundsQuery {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub original_transaction_id: Option<String>,
    #[serde(default)]
    pub processed_by: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRefundInput {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRefundResponse {
    pub deleted: bool,
}

