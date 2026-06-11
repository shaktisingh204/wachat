//! SabPay Payment Links — `plink_…` objects (Razorpay-style hosted links).
//!
//! A payment link is a shareable, fixed-amount collection request. The merchant
//! creates it; a payer opens its short URL (`<app>/pay/<plinkId>`), the public
//! session endpoint spins up a `pay_…` session, and the **finalize chokepoint**
//! flips the link `created → paid` and fires `payment_link.paid` — NOT this
//! module. A merchant can `cancel` a link while it is still `created`
//! (`created → cancelled`, fires `payment_link.cancelled`). Expiry is advisory
//! here (`expireBy` is surfaced to the payer; a future cron stamps `expired`).
//!
//! Mirrors the `orders` reference module: DTOs → `doc_to_*` mapper →
//! `{userId, mode}`-scoped store fns → Axum handlers. Routes are wired centrally
//! in `lib.rs`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_to_clean_json, mongo::MongoHandle};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::ids::new_id;
use crate::store::{self, iso_opt, num_i64, str_opt, str_or, user_oid, validate_amount, validate_notes};
use crate::webhooks;

const COLL: &str = store::PAYMENT_LINKS;
const DEFAULT_NAME: &str = "My business";

/* ── DTOs ────────────────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentLinkOut {
    pub id: String,
    pub mode: String,
    pub amount: i64,
    pub currency: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<Value>,
    pub short_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expire_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_id: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paid_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancelled_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaymentLinkBody {
    pub amount: i64,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub reference_id: Option<String>,
    #[serde(default)]
    pub customer_name: Option<String>,
    #[serde(default)]
    pub customer_email: Option<String>,
    #[serde(default)]
    pub customer_phone: Option<String>,
    #[serde(default)]
    pub expire_by: Option<String>,
    #[serde(default)]
    pub notes: Option<Value>,
    /// Set by the public API from the key prefix; the dashboard omits it.
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePaymentLinkBody {
    #[serde(default)]
    pub reference_id: Option<String>,
    #[serde(default)]
    pub customer_name: Option<String>,
    #[serde(default)]
    pub customer_email: Option<String>,
    #[serde(default)]
    pub customer_phone: Option<String>,
    #[serde(default)]
    pub expire_by: Option<String>,
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
#[serde(rename_all = "camelCase")]
pub struct PaymentLinkList {
    pub payment_links: Vec<PaymentLinkOut>,
}

/* ── public view + session DTOs ──────────────────────────────────────────── */

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicLinkView {
    pub plink_id: String,
    pub status: String,
    pub amount: i64,
    pub currency: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub business: crate::dto::CheckoutBusiness,
    pub mode: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionOut {
    pub checkout_url: String,
    pub payment_id: String,
}

/* ── mapper ──────────────────────────────────────────────────────────────── */

pub fn doc_to_payment_link(d: &Document) -> PaymentLinkOut {
    let plink_id = str_or(d, "plinkId", "");
    PaymentLinkOut {
        short_url: format!("{}/pay/{}", store::app_url(), plink_id),
        id: plink_id,
        mode: str_or(d, "mode", "test"),
        amount: num_i64(d, "amount"),
        currency: str_or(d, "currency", "INR"),
        status: str_or(d, "status", "created"),
        description: str_opt(d, "description"),
        reference_id: str_opt(d, "referenceId"),
        customer_name: str_opt(d, "customerName"),
        customer_email: str_opt(d, "customerEmail"),
        customer_phone: str_opt(d, "customerPhone"),
        notes: notes_opt(d),
        expire_by: iso_opt(d, "expireBy"),
        payment_id: str_opt(d, "paymentId"),
        created_at: iso_opt(d, "createdAt").unwrap_or_else(store::now_iso),
        paid_at: iso_opt(d, "paidAt"),
        cancelled_at: iso_opt(d, "cancelledAt"),
    }
}

fn notes_opt(d: &Document) -> Option<Value> {
    match d.get("notes") {
        Some(b) if !matches!(b, Bson::Null) => {
            let v = bson_to_clean_json(b.clone());
            if v.is_null() { None } else { Some(v) }
        }
        _ => None,
    }
}

/* ── store ───────────────────────────────────────────────────────────────── */

pub async fn create(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    body: CreatePaymentLinkBody,
) -> Result<PaymentLinkOut> {
    validate_amount(body.amount)?;
    let currency = body.currency.as_deref().unwrap_or("INR").to_uppercase();
    if currency != "INR" {
        return Err(ApiError::BadRequest("Only INR is supported right now.".to_owned()));
    }
    let notes = validate_notes(&body.notes)?;
    let plink_id = new_id("plink");
    let now = store::now_iso();
    let mut d = doc! {
        "_id": ObjectId::new(),
        "plinkId": &plink_id,
        "userId": uid,
        "mode": mode,
        "status": "created",
        "amount": body.amount,
        "currency": &currency,
        "createdAt": &now,
        "updatedAt": &now,
    };
    insert_optional(&mut d, "description", body.description.as_deref(), 200);
    insert_optional(&mut d, "referenceId", body.reference_id.as_deref(), 120);
    insert_optional(&mut d, "customerName", body.customer_name.as_deref(), 100);
    insert_optional(&mut d, "customerEmail", body.customer_email.as_deref(), 200);
    insert_optional(&mut d, "customerPhone", body.customer_phone.as_deref(), 20);
    if let Some(e) = body.expire_by.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        d.insert("expireBy", e.chars().take(40).collect::<String>());
    }
    if let Some(n) = notes {
        d.insert("notes", n);
    }
    mongo
        .collection::<Document>(COLL)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment_link.insert")))?;
    Ok(doc_to_payment_link(&d))
}

fn insert_optional(d: &mut Document, key: &str, value: Option<&str>, cap: usize) {
    if let Some(v) = value.map(str::trim).filter(|s| !s.is_empty()) {
        d.insert(key, v.chars().take(cap).collect::<String>());
    }
}

pub async fn list(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    status: Option<&str>,
    before: Option<&str>,
    limit: i64,
) -> Result<Vec<PaymentLinkOut>> {
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
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment_link.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment_link.collect")))?;
    Ok(docs.iter().map(doc_to_payment_link).collect())
}

pub async fn get_doc(mongo: &MongoHandle, uid: ObjectId, id: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "plinkId": id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment_link.get")))
}

/// Fetch a link by its public id WITHOUT a user scope (public surface).
pub async fn get_doc_public(mongo: &MongoHandle, id: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "plinkId": id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment_link.get_public")))
}

/* ── dashboard handlers ──────────────────────────────────────────────────── */

pub async fn list_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<PaymentLinkList>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = q.mode.as_deref().unwrap_or(&merchant.mode).to_owned();
    let payment_links = list(
        &mongo,
        uid,
        &mode,
        q.status.as_deref(),
        q.before.as_deref(),
        q.limit.unwrap_or(50),
    )
    .await?;
    Ok(Json(PaymentLinkList { payment_links }))
}

pub async fn create_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreatePaymentLinkBody>,
) -> Result<Json<PaymentLinkOut>> {
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
) -> Result<Json<PaymentLinkOut>> {
    let uid = user_oid(&user)?;
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No payment link \"{id}\".")))?;
    Ok(Json(doc_to_payment_link(&d)))
}

pub async fn update_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdatePaymentLinkBody>,
) -> Result<Json<PaymentLinkOut>> {
    let uid = user_oid(&user)?;

    // Only an open (still `created`) link is editable.
    let existing = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No payment link \"{id}\".")))?;
    if str_or(&existing, "status", "") != "created" {
        return Err(ApiError::Conflict(
            "Only an open payment link can be edited.".to_owned(),
        ));
    }

    let notes = validate_notes(&body.notes)?;
    let mut set = doc! { "updatedAt": store::now_iso() };
    for (key, value, cap) in [
        ("referenceId", &body.reference_id, 120usize),
        ("customerName", &body.customer_name, 100),
        ("customerEmail", &body.customer_email, 200),
        ("customerPhone", &body.customer_phone, 20),
        ("expireBy", &body.expire_by, 40),
    ] {
        if let Some(v) = value {
            let t = v.trim();
            if t.is_empty() {
                set.insert(key, Bson::Null);
            } else {
                set.insert(key, t.chars().take(cap).collect::<String>());
            }
        }
    }
    if let Some(n) = notes {
        set.insert("notes", n);
    }

    let res = mongo
        .collection::<Document>(COLL)
        .update_one(
            doc! { "plinkId": &id, "userId": uid, "status": "created" },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment_link.update")))?;
    if res.matched_count == 0 {
        return Err(ApiError::Conflict(
            "Only an open payment link can be edited.".to_owned(),
        ));
    }
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No payment link \"{id}\".")))?;
    Ok(Json(doc_to_payment_link(&d)))
}

pub async fn cancel_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<PaymentLinkOut>> {
    let uid = user_oid(&user)?;
    let now = store::now_iso();

    // Atomic guard: only an open link cancels (created → cancelled).
    let updated = mongo
        .collection::<Document>(COLL)
        .find_one_and_update(
            doc! { "plinkId": &id, "userId": uid, "status": "created" },
            doc! { "$set": { "status": "cancelled", "cancelledAt": &now, "updatedAt": &now } },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment_link.cancel")))?;

    let updated = match updated {
        Some(d) => d,
        None => {
            // Distinguish "missing" from "already finished" for a clearer error.
            return match get_doc(&mongo, uid, &id).await? {
                Some(d) => {
                    let status = str_or(&d, "status", "");
                    Err(ApiError::Conflict(format!(
                        "Payment link is already {status}; only an open link can be cancelled."
                    )))
                }
                None => Err(ApiError::NotFound(format!("No payment link \"{id}\"."))),
            };
        }
    };

    let mode = str_or(&updated, "mode", "test");
    let out = doc_to_payment_link(&updated);
    let value = serde_json::to_value(&out).unwrap_or(Value::Null);
    tokio::spawn(webhooks::dispatch(
        mongo.clone(),
        uid,
        "payment_link.cancelled".to_owned(),
        "paymentLink",
        value,
        out.id.clone(),
        mode,
    ));
    Ok(Json(out))
}

/* ── public handlers (no AuthUser) ───────────────────────────────────────── */

/// `GET /public/links/{id}` — payer-facing view of a link. The unguessable
/// `plink_…` id is the capability; the owner is resolved from the doc.
pub async fn public_view_handler(
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<PublicLinkView>> {
    let d = get_doc_public(&mongo, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Payment link not found.".to_owned()))?;
    let owner = d
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("payment link missing userId")))?;
    let business = store::merchant_branding(&mongo, owner).await;
    Ok(Json(PublicLinkView {
        plink_id: str_or(&d, "plinkId", &id),
        status: str_or(&d, "status", "created"),
        amount: num_i64(&d, "amount"),
        currency: str_or(&d, "currency", "INR"),
        description: str_opt(&d, "description"),
        business,
        mode: str_or(&d, "mode", "test"),
    }))
}

/// `POST /public/links/{id}/session` — start (or resume) checkout for a link.
///
/// - `paid`            → return the existing payment's checkout url + id.
/// - `cancelled`/`expired` → `Conflict` (link no longer collectible).
/// - `created`         → spin up a fresh `pay_…` session linked to this link.
///
/// The link → paid transition + `payment_link.paid` webhook are handled by the
/// finalize chokepoint when the payment succeeds, NOT here.
pub async fn public_session_handler(
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SessionOut>> {
    let d = get_doc_public(&mongo, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Payment link not found.".to_owned()))?;
    let owner = d
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("payment link missing userId")))?;
    let plink_id = str_or(&d, "plinkId", &id);
    let mode = str_or(&d, "mode", "test");
    let status = str_or(&d, "status", "created");

    match status.as_str() {
        "paid" => {
            // Already collected — hand back the existing payment.
            let payment_id = str_opt(&d, "paymentId").ok_or_else(|| {
                ApiError::Conflict("This payment link is already paid.".to_owned())
            })?;
            Ok(Json(SessionOut {
                checkout_url: format!("{}/pay/{}", store::app_url(), payment_id),
                payment_id,
            }))
        }
        "cancelled" => Err(ApiError::Conflict(
            "This payment link has been cancelled.".to_owned(),
        )),
        "expired" => Err(ApiError::Conflict(
            "This payment link has expired.".to_owned(),
        )),
        _ => {
            // `created` (or any open state) — create a new session.
            let amount = num_i64(&d, "amount");
            let description = str_opt(&d, "description");
            let customer = match (
                str_opt(&d, "customerName"),
                str_opt(&d, "customerEmail"),
                str_opt(&d, "customerPhone"),
            ) {
                (None, None, None) => None,
                (name, email, phone) => Some(crate::dto::CustomerIn { name, email, phone }),
            };
            let body = crate::dto::CreatePaymentBody {
                amount,
                currency: Some(str_or(&d, "currency", "INR")),
                description,
                customer,
                metadata: None,
                success_url: None,
                cancel_url: None,
                mode: Some(mode.clone()),
                order_id: None,
                customer_id: None,
                payment_link_id: Some(plink_id.clone()),
                payment_page_id: None,
                invoice_id: None,
                subscription_id: None,
                qr_code_id: None,
            };
            let payment = store::create_payment(&mongo, owner, &mode, body).await?;
            Ok(Json(SessionOut {
                checkout_url: payment.checkout_url,
                payment_id: payment.id,
            }))
        }
    }
}
