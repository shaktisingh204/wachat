//! SabPay QR Codes — `qr_…` UPI-style collect codes.
//!
//! A QR code is a stable, shareable payload (`payloadUrl = <app>/pay/<qrId>`)
//! that a payer scans to start a hosted-checkout session. Two usage shapes:
//! `single_use` (auto-closes on the first successful payment) and
//! `multiple_use` (stays open, accumulating many payments). A QR may carry a
//! `fixedAmount` (the payer cannot change it) or be open-amount (the payer
//! enters the amount at session time).
//!
//! Mirrors the `orders` reference module: DTOs → `doc_to_qr` mapper →
//! `{userId, mode}`-scoped store fns → Axum handlers. Routes are wired centrally
//! in `lib.rs`.
//!
//! IMPORTANT — the credit chokepoint lives in `finalize.rs`, not here. When a
//! payment linked via `qrCodeId` turns `succeeded`, `finalize::credit_qr`
//! increments `paymentsCountReceived`/`paymentsAmountReceived`, auto-closes a
//! `single_use` QR (`closeReason:"paid"`), and fires `qr_code.credited`. This
//! module only fires `qr_code.closed` from the on-demand `close_handler`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::ReturnDocument;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::dto::{CheckoutBusiness, CreatePaymentBody};
use crate::ids::new_id;
use crate::store::{self, iso_opt, num_i64, num_opt_i64, str_opt, str_or, user_oid, validate_amount};
use crate::webhooks;

const COLL: &str = store::QR_CODES;
const DEFAULT_NAME: &str = "My business";

/* ── DTOs ────────────────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QrCodeOut {
    pub id: String,
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub usage: String,
    pub fixed_amount: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub status: String,
    pub payload_url: String,
    pub payments_count_received: i64,
    pub payments_amount_received: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub closed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateQrCodeBody {
    #[serde(default)]
    pub name: Option<String>,
    /// `"single_use"` | `"multiple_use"`.
    pub usage: String,
    #[serde(default)]
    pub fixed_amount: bool,
    /// Required (and validated) when `fixedAmount` is true.
    #[serde(default)]
    pub amount: Option<i64>,
    #[serde(default)]
    pub description: Option<String>,
    /// Set by the public API from the key prefix; the dashboard omits it.
    #[serde(default)]
    pub mode: Option<String>,
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
pub struct QrCodeList {
    pub qr_codes: Vec<QrCodeOut>,
}

/* ── public view + session ───────────────────────────────────────────────── */

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicQrView {
    pub qr_id: String,
    pub status: String,
    pub fixed_amount: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub business: CheckoutBusiness,
    pub mode: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSessionBody {
    /// Required for open-amount QRs; ignored for fixed-amount QRs.
    #[serde(default)]
    pub amount: Option<i64>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionOut {
    pub checkout_url: String,
    pub payment_id: String,
}

/* ── mapper ──────────────────────────────────────────────────────────────── */

pub fn doc_to_qr(d: &Document) -> QrCodeOut {
    let qr_id = str_or(d, "qrId", "");
    QrCodeOut {
        payload_url: format!("{}/pay/{}", store::app_url(), qr_id),
        id: qr_id,
        mode: str_or(d, "mode", "test"),
        name: str_opt(d, "name"),
        usage: str_or(d, "usage", "multiple_use"),
        fixed_amount: store::bool_or(d, "fixedAmount", false),
        amount: num_opt_i64(d, "amount"),
        description: str_opt(d, "description"),
        status: str_or(d, "status", "active"),
        payments_count_received: num_i64(d, "paymentsCountReceived"),
        payments_amount_received: num_i64(d, "paymentsAmountReceived"),
        closed_at: iso_opt(d, "closedAt"),
        created_at: iso_opt(d, "createdAt").unwrap_or_else(store::now_iso),
    }
}

/* ── store ───────────────────────────────────────────────────────────────── */

pub async fn create(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    body: CreateQrCodeBody,
) -> Result<QrCodeOut> {
    let usage = match body.usage.trim() {
        "single_use" => "single_use",
        "multiple_use" => "multiple_use",
        _ => {
            return Err(ApiError::Validation(
                "usage must be \"single_use\" or \"multiple_use\".".to_owned(),
            ));
        }
    };

    let amount = if body.fixed_amount {
        let a = body
            .amount
            .ok_or_else(|| ApiError::Validation("amount is required for a fixed-amount QR.".to_owned()))?;
        validate_amount(a)?;
        Some(a)
    } else {
        // Ignore any amount sent on an open-amount QR.
        None
    };

    let qr_id = new_id("qr");
    let now = store::now_iso();
    let mut d = doc! {
        "_id": ObjectId::new(),
        "qrId": &qr_id,
        "userId": uid,
        "mode": mode,
        "usage": usage,
        "fixedAmount": body.fixed_amount,
        "status": "active",
        "paymentsCountReceived": 0_i64,
        "paymentsAmountReceived": 0_i64,
        "createdAt": &now,
        "updatedAt": &now,
    };
    if let Some(n) = body.name.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        d.insert("name", n.chars().take(140).collect::<String>());
    }
    if let Some(a) = amount {
        d.insert("amount", a);
    }
    if let Some(desc) = body.description.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        d.insert("description", desc.chars().take(500).collect::<String>());
    }
    mongo
        .collection::<Document>(COLL)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.qr.insert")))?;
    Ok(doc_to_qr(&d))
}

pub async fn list(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    status: Option<&str>,
    before: Option<&str>,
    limit: i64,
) -> Result<Vec<QrCodeOut>> {
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
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.qr.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.qr.collect")))?;
    Ok(docs.iter().map(doc_to_qr).collect())
}

pub async fn get_doc(mongo: &MongoHandle, uid: ObjectId, id: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "qrId": id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.qr.get")))
}

/// Public lookup by the unguessable `qrId` only — no principal. Mirrors
/// `store::get_payment_doc_by_id`: the id IS the capability.
pub async fn get_doc_public(mongo: &MongoHandle, id: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "qrId": id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.qr.get_public")))
}

/* ── dashboard handlers ──────────────────────────────────────────────────── */

pub async fn list_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<QrCodeList>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = q.mode.as_deref().unwrap_or(&merchant.mode).to_owned();
    let qr_codes = list(
        &mongo,
        uid,
        &mode,
        q.status.as_deref(),
        q.before.as_deref(),
        q.limit.unwrap_or(50),
    )
    .await?;
    Ok(Json(QrCodeList { qr_codes }))
}

pub async fn create_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateQrCodeBody>,
) -> Result<Json<QrCodeOut>> {
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
) -> Result<Json<QrCodeOut>> {
    let uid = user_oid(&user)?;
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No QR code \"{id}\".")))?;
    Ok(Json(doc_to_qr(&d)))
}

/// `POST /qr-codes/{id}/close` — close an active QR on demand. Atomic
/// `active → closed` so a concurrent close (or a `single_use` auto-close from
/// the finalize chokepoint) can't double-fire `qr_code.closed`.
pub async fn close_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<QrCodeOut>> {
    let uid = user_oid(&user)?;
    let now = store::now_iso();
    let coll = mongo.collection::<Document>(COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "qrId": &id, "userId": uid, "status": "active" },
            doc! { "$set": {
                "status": "closed",
                "closedAt": &now,
                "closeReason": "on_demand",
                "updatedAt": &now,
            }},
        )
        .return_document(ReturnDocument::After)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.qr.close")))?;

    let updated = match updated {
        Some(d) => d,
        None => {
            // Either it doesn't exist for this user, or it's already closed.
            let existing = get_doc(&mongo, uid, &id)
                .await?
                .ok_or_else(|| ApiError::NotFound(format!("No QR code \"{id}\".")))?;
            return Err(ApiError::Conflict(format!(
                "QR code \"{id}\" is already {}.",
                str_or(&existing, "status", "closed")
            )));
        }
    };

    let mode = str_or(&updated, "mode", "test");
    let out = doc_to_qr(&updated);
    let value = serde_json::to_value(&out).unwrap_or(serde_json::Value::Null);
    tokio::spawn(webhooks::dispatch(
        mongo.clone(),
        uid,
        "qr_code.closed".to_owned(),
        "qrCode",
        value,
        id,
        mode,
    ));
    Ok(Json(out))
}

/* ── public handlers (no AuthUser) ───────────────────────────────────────── */

/// `GET /public/qr/{id}` — payer-facing QR view. Resolves the owner from the
/// doc for branding; rejects a closed QR.
pub async fn public_view_handler(
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<PublicQrView>> {
    let d = get_doc_public(&mongo, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound("QR code not found.".to_owned()))?;
    if str_or(&d, "status", "active") != "active" {
        return Err(ApiError::Conflict("This QR code is no longer active.".to_owned()));
    }
    let owner = d
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("qr code missing userId")))?;
    let business = store::merchant_branding(&mongo, owner).await;
    let fixed_amount = store::bool_or(&d, "fixedAmount", false);
    Ok(Json(PublicQrView {
        qr_id: str_or(&d, "qrId", ""),
        status: str_or(&d, "status", "active"),
        fixed_amount,
        amount: if fixed_amount { num_opt_i64(&d, "amount") } else { None },
        description: str_opt(&d, "description"),
        business,
        mode: str_or(&d, "mode", "test"),
    }))
}

/// `POST /public/qr/{id}/session` — start a hosted-checkout payment from a QR.
/// For a fixed-amount QR the amount is the QR's stored amount; otherwise the
/// payer-supplied amount is validated. The created payment carries
/// `qrCodeId`, so the finalize chokepoint credits the QR + auto-closes a
/// single-use code on success.
pub async fn public_session_handler(
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<PublicSessionBody>,
) -> Result<Json<SessionOut>> {
    let d = get_doc_public(&mongo, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound("QR code not found.".to_owned()))?;
    if str_or(&d, "status", "active") != "active" {
        return Err(ApiError::Conflict("This QR code is no longer active.".to_owned()));
    }
    let owner = d
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("qr code missing userId")))?;
    let mode = str_or(&d, "mode", "test");
    let qr_id = str_or(&d, "qrId", "");
    let fixed_amount = store::bool_or(&d, "fixedAmount", false);

    let amount = if fixed_amount {
        num_opt_i64(&d, "amount")
            .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("fixed-amount QR missing amount")))?
    } else {
        let a = body
            .amount
            .ok_or_else(|| ApiError::BadRequest("amount is required for this QR code.".to_owned()))?;
        validate_amount(a)?;
        a
    };

    // Description: QR's own description, falling back to the payer's note.
    let description = str_opt(&d, "description").or_else(|| {
        body.description
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
    });

    let payment = store::create_payment(
        &mongo,
        owner,
        &mode,
        CreatePaymentBody {
            amount,
            currency: None,
            description,
            customer: None,
            metadata: None,
            success_url: None,
            cancel_url: None,
            mode: Some(mode.clone()),
            order_id: None,
            customer_id: None,
            payment_link_id: None,
            payment_page_id: None,
            invoice_id: None,
            subscription_id: None,
            qr_code_id: Some(qr_id),
        },
    )
    .await?;

    // payment.created so subscribed endpoints see the new session.
    tokio::spawn(webhooks::dispatch_payment(
        mongo.clone(),
        owner,
        "payment.created".to_owned(),
        payment.clone(),
        mode,
    ));

    Ok(Json(SessionOut {
        checkout_url: payment.checkout_url,
        payment_id: payment.id,
    }))
}
