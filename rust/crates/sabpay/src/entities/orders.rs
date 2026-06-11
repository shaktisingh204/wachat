//! SabPay Orders — Razorpay-style `order_…` objects.
//!
//! An order is an intent to collect a fixed amount; one or more payments can be
//! attached to it (via `order_id` on payment creation). It moves
//! `created → attempted → paid`; the `order.paid` webhook fires from the
//! finalize chokepoint when a linked payment succeeds.
//!
//! This module is the REFERENCE TEMPLATE every other entity module mirrors:
//! DTOs → `doc_to_*` mapper → store fns (`{userId, mode}`-scoped) → Axum
//! handlers. Routes are wired centrally in `lib.rs`.

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
use serde_json::Value;

use crate::ids::new_id;
use crate::store::{
    self, doc_to_payment, iso_opt, num_i64, str_opt, str_or, user_oid, validate_amount,
    validate_notes,
};

const COLL: &str = store::ORDERS;
const DEFAULT_NAME: &str = "My business";

/* ── DTOs ────────────────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderOut {
    pub id: String,
    pub mode: String,
    pub amount: i64,
    pub amount_paid: i64,
    pub amount_due: i64,
    pub currency: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub receipt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<Value>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paid_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrderBody {
    pub amount: i64,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub receipt: Option<String>,
    #[serde(default)]
    pub notes: Option<Value>,
    /// Set by the public API from the key prefix; the dashboard omits it.
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrderBody {
    /// Only `notes` is mutable on an order (Razorpay parity).
    #[serde(default)]
    pub notes: Option<Value>,
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
pub struct OrderList {
    pub orders: Vec<OrderOut>,
}

/* ── mapper ──────────────────────────────────────────────────────────────── */

pub fn doc_to_order(d: &Document) -> OrderOut {
    OrderOut {
        id: str_or(d, "orderId", ""),
        mode: str_or(d, "mode", "test"),
        amount: num_i64(d, "amount"),
        amount_paid: num_i64(d, "amountPaid"),
        amount_due: num_i64(d, "amountDue"),
        currency: str_or(d, "currency", "INR"),
        status: str_or(d, "status", "created"),
        receipt: str_opt(d, "receipt"),
        notes: metadata_opt_field(d, "notes"),
        created_at: iso_opt(d, "createdAt").unwrap_or_else(store::now_iso),
        paid_at: iso_opt(d, "paidAt"),
    }
}

/// Like `store::metadata_opt` but for an arbitrary object field (e.g. `notes`).
fn metadata_opt_field(d: &Document, key: &str) -> Option<Value> {
    match d.get(key) {
        Some(b) if !matches!(b, bson::Bson::Null) => {
            let v = sabnode_db::bson_to_clean_json(b.clone());
            if v.is_null() { None } else { Some(v) }
        }
        _ => None,
    }
}

/* ── store ───────────────────────────────────────────────────────────────── */

pub async fn create(mongo: &MongoHandle, uid: ObjectId, mode: &str, body: CreateOrderBody) -> Result<OrderOut> {
    validate_amount(body.amount)?;
    let currency = body.currency.as_deref().unwrap_or("INR").to_uppercase();
    if currency != "INR" {
        return Err(ApiError::BadRequest("Only INR is supported right now.".to_owned()));
    }
    let notes = validate_notes(&body.notes)?;
    let order_id = new_id("order");
    let now = store::now_iso();
    let mut d = doc! {
        "_id": ObjectId::new(),
        "orderId": &order_id,
        "userId": uid,
        "mode": mode,
        "status": "created",
        "amount": body.amount,
        "amountPaid": 0_i64,
        "amountDue": body.amount,
        "currency": &currency,
        "createdAt": &now,
        "updatedAt": &now,
    };
    if let Some(r) = body.receipt.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        d.insert("receipt", r.chars().take(120).collect::<String>());
    }
    if let Some(n) = notes {
        d.insert("notes", n);
    }
    mongo
        .collection::<Document>(COLL)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.order.insert")))?;
    Ok(doc_to_order(&d))
}

pub async fn list(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    status: Option<&str>,
    before: Option<&str>,
    limit: i64,
) -> Result<Vec<OrderOut>> {
    let mut filter = doc! { "userId": uid, "mode": mode };
    if let Some(s) = status {
        filter.insert("status", s);
    }
    if let Some(b) = before {
        filter.insert("createdAt", doc! { "$lt": b });
    }
    let cursor = mongo
        .collection::<Document>(COLL)
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(limit.clamp(1, 100))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.order.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.order.collect")))?;
    Ok(docs.iter().map(doc_to_order).collect())
}

pub async fn get_doc(mongo: &MongoHandle, uid: ObjectId, id: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "orderId": id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.order.get")))
}

/* ── handlers ────────────────────────────────────────────────────────────── */

pub async fn list_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<OrderList>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = q.mode.as_deref().unwrap_or(&merchant.mode).to_owned();
    let orders = list(&mongo, uid, &mode, q.status.as_deref(), q.before.as_deref(), q.limit.unwrap_or(50)).await?;
    Ok(Json(OrderList { orders }))
}

pub async fn create_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateOrderBody>,
) -> Result<Json<OrderOut>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = match body.mode.as_deref() {
        Some(m @ ("test" | "live")) => m.to_owned(),
        _ => merchant.mode.clone(),
    };
    Ok(Json(create(&mongo, uid, &mode, body).await?))
}

pub async fn get_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<OrderOut>> {
    let uid = user_oid(&user)?;
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No order \"{id}\".")))?;
    Ok(Json(doc_to_order(&d)))
}

pub async fn update_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateOrderBody>,
) -> Result<Json<OrderOut>> {
    let uid = user_oid(&user)?;
    let notes = validate_notes(&body.notes)?;
    let mut set = doc! { "updatedAt": store::now_iso() };
    if let Some(n) = notes {
        set.insert("notes", n);
    }
    let coll = mongo.collection::<Document>(COLL);
    let res = coll
        .update_one(doc! { "orderId": &id, "userId": uid }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.order.update")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound(format!("No order \"{id}\".")));
    }
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No order \"{id}\".")))?;
    Ok(Json(doc_to_order(&d)))
}

/// `GET /orders/{id}/payments` — payments attached to an order.
pub async fn payments_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let uid = user_oid(&user)?;
    // Confirm the order belongs to the caller before listing.
    if get_doc(&mongo, uid, &id).await?.is_none() {
        return Err(ApiError::NotFound(format!("No order \"{id}\".")));
    }
    let cursor = mongo
        .collection::<Document>(store::PAYMENTS)
        .find(doc! { "userId": uid, "orderId": &id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.order.payments")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.order.payments.collect")))?;
    let payments: Vec<_> = docs.iter().map(doc_to_payment).collect();
    Ok(Json(serde_json::json!({ "payments": payments })))
}
