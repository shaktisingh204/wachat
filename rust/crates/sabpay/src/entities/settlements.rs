//! SabPay Settlements — `setl_…` read-only objects.
//!
//! A settlement is the daily payout the platform makes to a merchant: it sweeps
//! every **live**, succeeded payment that is not yet attributed to a settlement
//! (and not under an open dispute), nets out the platform fee + GST, refunds,
//! and dispute deductions, and stamps the surviving `settlementId` (+ `fee` /
//! `tax`) back onto each payment and refund. That sweep is performed by a daily
//! **cron RUNNER living in a separate module** — this file never writes a
//! settlement doc, it only READS them back for the dashboard.
//!
//! Because settlements only ever exist for real money, every query here is
//! pinned to `mode: "live"`; test-mode payments are never settled.
//!
//! Mirrors the `orders` reference module: DTO → `doc_to_settlement` mapper →
//! `{userId, mode}`-scoped store fns → Axum handlers. Routes are wired centrally
//! in `lib.rs`; this read module emits no webhooks (the cron fires
//! `settlement.processed`).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::store::{
    self, doc_to_payment, iso_opt, num_i64, num_opt_i64, str_opt, str_or, user_oid,
};

const COLL: &str = store::SETTLEMENTS;
const DEFAULT_NAME: &str = "My business";
/// Settlements only ever exist for real money — every query is pinned to live.
const MODE: &str = "live";

/* ── DTOs ────────────────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementOut {
    pub id: String,
    pub mode: String,
    pub status: String,
    pub gross_amount: i64,
    pub fees_total: i64,
    pub tax_total: i64,
    pub refunds_total: i64,
    pub disputes_deducted: i64,
    /// Net amount actually paid out.
    pub amount: i64,
    pub payment_count: i64,
    pub refund_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub utr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub period_end: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settled_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    pub before: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct SettlementList {
    pub settlements: Vec<SettlementOut>,
}

/// Compact refund row shown in the settlement detail (the refunds the
/// settlement deducted).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementRefundOut {
    pub id: String,
    pub amount: i64,
    pub payment_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementDetail {
    pub settlement: SettlementOut,
    pub payments: Vec<crate::dto::PaymentOut>,
    pub refunds: Vec<SettlementRefundOut>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementSummary {
    /// Net amount eligible to be settled on the next cron run (paise).
    pub next_amount: i64,
    /// How many succeeded, unsettled, non-disputed payments feed `next_amount`.
    pub eligible_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_settled_at: Option<String>,
}

/* ── mapper ──────────────────────────────────────────────────────────────── */

pub fn doc_to_settlement(d: &Document) -> SettlementOut {
    SettlementOut {
        id: str_or(d, "setlId", ""),
        mode: str_or(d, "mode", MODE),
        status: str_or(d, "status", "processed"),
        gross_amount: num_i64(d, "grossAmount"),
        fees_total: num_i64(d, "feesTotal"),
        tax_total: num_i64(d, "taxTotal"),
        refunds_total: num_i64(d, "refundsTotal"),
        disputes_deducted: num_i64(d, "disputesDeducted"),
        amount: num_i64(d, "amount"),
        payment_count: num_i64(d, "paymentCount"),
        refund_count: num_i64(d, "refundCount"),
        utr: str_opt(d, "utr"),
        period_end: iso_opt(d, "periodEnd"),
        settled_at: iso_opt(d, "settledAt"),
        created_at: iso_opt(d, "createdAt").unwrap_or_else(store::now_iso),
    }
}

/* ── store ───────────────────────────────────────────────────────────────── */

pub async fn list(
    mongo: &MongoHandle,
    uid: ObjectId,
    before: Option<&str>,
    limit: i64,
) -> Result<Vec<SettlementOut>> {
    let mut filter = doc! { "userId": uid, "mode": MODE };
    if let Some(b) = before {
        filter.insert("createdAt", doc! { "$lt": b });
    }
    let cursor = mongo
        .collection::<Document>(COLL)
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(limit.clamp(1, 100))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.settlement.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.settlement.collect")))?;
    Ok(docs.iter().map(doc_to_settlement).collect())
}

pub async fn get_doc(mongo: &MongoHandle, uid: ObjectId, id: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "setlId": id, "userId": uid, "mode": MODE })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.settlement.get")))
}

/* ── handlers ────────────────────────────────────────────────────────────── */

/// `GET /settlements` — the merchant's processed settlements, newest first.
/// Settlements are always live-mode.
pub async fn list_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<SettlementList>> {
    let uid = user_oid(&user)?;
    // Ensure the merchant row exists (parity with every other dashboard read).
    store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let settlements = list(&mongo, uid, q.before.as_deref(), q.limit.unwrap_or(50)).await?;
    Ok(Json(SettlementList { settlements }))
}

/// `GET /settlements/summary` — the projected NEXT payout: the net of every
/// live, succeeded payment not yet attributed to a settlement and not under an
/// open dispute. Uses the stamped `fee`/`tax` when present, else estimates with
/// the merchant's current fee rate.
pub async fn summary_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<SettlementSummary>> {
    let uid = user_oid(&user)?;
    store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;

    // Resolve the merchant's fee rate once for the fallback estimate.
    let merchant_doc = store::get_merchant_doc(&mongo, uid).await?;
    let fee_bps = crate::fees::fee_bps_for(merchant_doc.as_ref());

    // Eligible payments: live + succeeded + no settlementId + not in open dispute.
    let cursor = mongo
        .collection::<Document>(store::PAYMENTS)
        .find(doc! {
            "userId": uid,
            "mode": MODE,
            "status": "succeeded",
            "settlementId": { "$exists": false },
            "disputeStatus": { "$ne": "open" },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpay.settlement.summary.payments"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpay.settlement.summary.collect"))
    })?;

    let mut next_amount = 0_i64;
    let mut eligible_count = 0_i64;
    for d in &docs {
        let amount = num_i64(d, "amount");
        // Prefer the stamped fee/tax (finalize-success writes them); otherwise
        // estimate at the merchant's current rate so the projection is stable.
        let (fee, tax) = match (num_opt_i64(d, "fee"), num_opt_i64(d, "tax")) {
            (Some(f), Some(t)) => (f, t),
            _ => {
                let b = crate::fees::compute(amount, fee_bps);
                (b.fee, b.tax)
            }
        };
        next_amount += (amount - fee - tax).max(0);
        eligible_count += 1;
    }

    // Most recent settled-at, for the dashboard's "last payout" line.
    let last_cursor = mongo
        .collection::<Document>(COLL)
        .find(doc! { "userId": uid, "mode": MODE })
        .sort(doc! { "createdAt": -1 })
        .limit(1)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpay.settlement.summary.last"))
        })?;
    let last_docs: Vec<Document> = last_cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpay.settlement.summary.last.collect"))
    })?;
    let last_settled_at = last_docs
        .first()
        .and_then(|d| iso_opt(d, "settledAt").or_else(|| iso_opt(d, "createdAt")));

    Ok(Json(SettlementSummary {
        next_amount,
        eligible_count,
        last_settled_at,
    }))
}

/// `GET /settlements/{id}` — a settlement with the payments + refunds it covered
/// (everything stamped with this `settlementId`).
pub async fn get_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SettlementDetail>> {
    let uid = user_oid(&user)?;
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No settlement \"{id}\".")))?;
    let settlement = doc_to_settlement(&d);

    // Payments attributed to this settlement.
    let pay_cursor = mongo
        .collection::<Document>(store::PAYMENTS)
        .find(doc! { "userId": uid, "settlementId": &id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpay.settlement.payments"))
        })?;
    let pay_docs: Vec<Document> = pay_cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpay.settlement.payments.collect"))
    })?;
    let payments: Vec<_> = pay_docs.iter().map(doc_to_payment).collect();

    // Refunds the settlement deducted.
    let rfnd_cursor = mongo
        .collection::<Document>(store::REFUNDS)
        .find(doc! { "userId": uid, "settlementId": &id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabpay.settlement.refunds"))
        })?;
    let rfnd_docs: Vec<Document> = rfnd_cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabpay.settlement.refunds.collect"))
    })?;
    let refunds: Vec<SettlementRefundOut> = rfnd_docs
        .iter()
        .map(|r| SettlementRefundOut {
            id: str_or(r, "refundId", ""),
            amount: num_i64(r, "amount"),
            payment_id: str_or(r, "paymentId", ""),
        })
        .collect();

    Ok(Json(SettlementDetail {
        settlement,
        payments,
        refunds,
    }))
}
