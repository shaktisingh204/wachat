//! SabPay Refunds — `rfnd_…` objects against a succeeded payment.
//!
//! Full or partial. The refundable remainder is guarded atomically against
//! concurrent over-refunds via a `$expr` filter on `find_one_and_update`. There
//! is no PayU refund API here: a **test** refund is instantly `processed`; a
//! **live** refund is `pending` and the settlement cron deducts it from the
//! merchant's next settlement, then marks it `processed`. Fires
//! `refund.created` (+ `refund.processed` for test).

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::ReturnDocument;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_to_clean_json, mongo::MongoHandle};
use serde::{Deserialize, Serialize};

use crate::ids::new_id;
use crate::store::{self, iso_opt, num_i64, str_opt, str_or, user_oid, validate_notes};
use crate::webhooks;

const COLL: &str = store::REFUNDS;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefundOut {
    pub id: String,
    pub mode: String,
    pub payment_id: String,
    pub amount: i64,
    pub currency: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settlement_id: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub processed_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRefundBody {
    /// Omit for a full refund of the remaining amount.
    #[serde(default)]
    pub amount: Option<i64>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub notes: Option<serde_json::Value>,
}

pub fn doc_to_refund(d: &Document) -> RefundOut {
    RefundOut {
        id: str_or(d, "refundId", ""),
        mode: str_or(d, "mode", "test"),
        payment_id: str_or(d, "paymentId", ""),
        amount: num_i64(d, "amount"),
        currency: str_or(d, "currency", "INR"),
        status: str_or(d, "status", "pending"),
        reason: str_opt(d, "reason"),
        notes: match d.get("notes") {
            Some(b) if !matches!(b, Bson::Null) => {
                let v = bson_to_clean_json(b.clone());
                if v.is_null() { None } else { Some(v) }
            }
            _ => None,
        },
        settlement_id: str_opt(d, "settlementId"),
        created_at: iso_opt(d, "createdAt").unwrap_or_else(store::now_iso),
        processed_at: iso_opt(d, "processedAt"),
    }
}

/* ── handlers ────────────────────────────────────────────────────────────── */

pub async fn create_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(payment_id): Path<String>,
    Json(body): Json<CreateRefundBody>,
) -> Result<Json<RefundOut>> {
    let uid = user_oid(&user)?;

    let pay = store::get_payment_doc_by_id(&mongo, &payment_id)
        .await?
        .filter(|d| d.get_object_id("userId").ok() == Some(uid))
        .ok_or_else(|| ApiError::NotFound(format!("No payment \"{payment_id}\".")))?;
    if str_or(&pay, "status", "") != "succeeded" {
        return Err(ApiError::BadRequest(
            "Only succeeded payments can be refunded.".to_owned(),
        ));
    }
    let mode = str_or(&pay, "mode", "test");
    let currency = str_or(&pay, "currency", "INR");
    let total = num_i64(&pay, "amount");
    let already = num_i64(&pay, "amountRefunded");
    let remaining = (total - already).max(0);
    if remaining == 0 {
        return Err(ApiError::BadRequest("This payment is fully refunded.".to_owned()));
    }
    let amount = body.amount.unwrap_or(remaining);
    if amount < 1 {
        return Err(ApiError::BadRequest("Refund amount must be at least 1 paisa.".to_owned()));
    }
    if amount > remaining {
        return Err(ApiError::BadRequest(format!(
            "Refund exceeds the refundable amount ({remaining} paise)."
        )));
    }
    let notes = validate_notes(&body.notes)?;

    // Atomic guard against concurrent over-refund: only increment when the new
    // total stays within the captured amount.
    let now = store::now_iso();
    let pcoll = mongo.collection::<Document>(store::PAYMENTS);
    let updated_pay = pcoll
        .find_one_and_update(
            doc! {
                "paymentId": &payment_id,
                "userId": uid,
                "status": "succeeded",
                "$expr": { "$lte": [ { "$add": [ "$amountRefunded", amount ] }, "$amount" ] },
            },
            doc! { "$inc": { "amountRefunded": amount }, "$set": { "updatedAt": &now } },
        )
        .return_document(ReturnDocument::After)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.refund.guard")))?
        .ok_or_else(|| {
            ApiError::Conflict("Refund exceeds the refundable amount (concurrent refund).".to_owned())
        })?;

    let new_refunded = num_i64(&updated_pay, "amountRefunded");
    let refund_status = if new_refunded >= total { "full" } else { "partial" };
    let _ = pcoll
        .update_one(
            doc! { "paymentId": &payment_id },
            doc! { "$set": { "refundStatus": refund_status } },
        )
        .await;

    let refund_id = new_id("rfnd");
    let status = if mode == "test" { "processed" } else { "pending" };
    let mut d = doc! {
        "_id": ObjectId::new(),
        "refundId": &refund_id,
        "userId": uid,
        "mode": &mode,
        "paymentId": &payment_id,
        "amount": amount,
        "currency": &currency,
        "status": status,
        "createdAt": &now,
        "updatedAt": &now,
    };
    if let Some(r) = body.reason.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        d.insert("reason", r.chars().take(200).collect::<String>());
    }
    if let Some(n) = notes {
        d.insert("notes", n);
    }
    if status == "processed" {
        d.insert("processedAt", &now);
    }
    mongo
        .collection::<Document>(COLL)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.refund.insert")))?;

    let out = doc_to_refund(&d);
    let value = serde_json::to_value(&out).unwrap_or(serde_json::Value::Null);
    tokio::spawn(webhooks::dispatch(
        mongo.clone(),
        uid,
        "refund.created".to_owned(),
        "refund",
        value.clone(),
        refund_id.clone(),
        mode.clone(),
    ));
    if status == "processed" {
        tokio::spawn(webhooks::dispatch(
            mongo.clone(),
            uid,
            "refund.processed".to_owned(),
            "refund",
            value,
            refund_id,
            mode,
        ));
    }
    Ok(Json(out))
}

pub async fn list_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    axum::extract::Query(q): axum::extract::Query<ListQuery>,
) -> Result<Json<RefundList>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, "My business").await?;
    let mode = q.mode.as_deref().unwrap_or(&merchant.mode).to_owned();
    let mut filter = doc! { "userId": uid, "mode": &mode };
    if let Some(s) = q.status.as_deref() {
        filter.insert("status", s);
    }
    if let Some(b) = q.before.as_deref() {
        filter.insert("createdAt", doc! { "$lt": b });
    }
    let refunds = query(&mongo, filter, q.limit.unwrap_or(50)).await?;
    Ok(Json(RefundList { refunds }))
}

pub async fn list_for_payment_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(payment_id): Path<String>,
) -> Result<Json<RefundList>> {
    let uid = user_oid(&user)?;
    let refunds = query(&mongo, doc! { "userId": uid, "paymentId": &payment_id }, 100).await?;
    Ok(Json(RefundList { refunds }))
}

pub async fn get_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<RefundOut>> {
    let uid = user_oid(&user)?;
    let d = mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "refundId": &id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.refund.get")))?
        .ok_or_else(|| ApiError::NotFound(format!("No refund \"{id}\".")))?;
    Ok(Json(doc_to_refund(&d)))
}

async fn query(mongo: &MongoHandle, filter: Document, limit: i64) -> Result<Vec<RefundOut>> {
    let cursor = mongo
        .collection::<Document>(COLL)
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(limit.clamp(1, 100))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.refund.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.refund.collect")))?;
    Ok(docs.iter().map(doc_to_refund).collect())
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub before: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct RefundList {
    pub refunds: Vec<RefundOut>,
}
