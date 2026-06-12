//! On-disk shapes for the four POS collections.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

// ─── Shared sub-types ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PosLineItem {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_id: Option<ObjectId>,
    pub name: String,
    pub quantity: f64,
    pub rate: f64,
    #[serde(default)]
    pub tax_rate: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PosPaymentSplit {
    /// `'cash' | 'card' | 'upi' | 'wallet'`
    pub method: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RefundedLineItem {
    /// 0-indexed position in the original transaction's `lineItems[]`.
    pub original_line_item_index: i32,
    pub quantity: f64,
    pub refund_amount: f64,
}

// ─── crm_pos_sessions ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPosSession {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — set on documents created through the
    /// project-scoped (`/v1/sabcrm/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    pub terminal_id: String,
    pub opened_by: ObjectId,
    #[serde(rename = "openedAt")]
    pub opened_at: BsonDateTime,
    pub opening_cash: f64,

    #[serde(default, skip_serializing_if = "Option::is_none", rename = "closedAt")]
    pub closed_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub closing_cash: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_cash: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discrepancy: Option<f64>,

    /// `"open" | "closed" | "reconciled" | "archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

// ─── crm_pos_transactions ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPosTransaction {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — set on documents created through the
    /// project-scoped (`/v1/sabcrm/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    pub session_id: ObjectId,
    /// Generated `TXN-YYYYMMDD-NNNN`.
    pub transaction_number: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_id: Option<ObjectId>,

    #[serde(default)]
    pub line_items: Vec<PosLineItem>,

    pub subtotal: f64,
    pub tax_total: f64,
    pub total: f64,

    /// `'cash' | 'card' | 'upi' | 'wallet' | 'split'`.
    pub payment_method: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_splits: Option<Vec<PosPaymentSplit>>,

    /// `"completed" | "voided" | "refunded"`.
    pub status: String,

    pub cashier_id: ObjectId,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

// ─── crm_pos_holds ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPosHold {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — set on documents created through the
    /// project-scoped (`/v1/sabcrm/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    pub session_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_id: Option<ObjectId>,

    #[serde(default)]
    pub line_items: Vec<PosLineItem>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hold_reason: Option<String>,
    pub held_by: ObjectId,
    pub held_at: BsonDateTime,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recalled_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recalled_transaction_id: Option<ObjectId>,

    /// `"held" | "recalled" | "voided" | "archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

// ─── crm_pos_refunds ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmPosRefund {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — set on documents created through the
    /// project-scoped (`/v1/sabcrm/*`) mounts; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    pub original_transaction_id: ObjectId,
    pub reason: String,

    #[serde(default)]
    pub refunded_line_items: Vec<RefundedLineItem>,

    pub refund_total: f64,
    /// `'cash' | 'card' | 'upi' | 'wallet'`.
    pub refund_method: String,
    pub processed_by: ObjectId,
    pub processed_at: BsonDateTime,

    /// `"pending" | "completed" | "voided" | "archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
