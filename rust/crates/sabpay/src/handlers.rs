//! Axum handlers for the SabPay surface.
//!
//! Dashboard handlers take [`AuthUser`] and scope every read/write to the
//! caller's user id. Public handlers (hosted checkout, PayU callback) take no
//! `AuthUser` — the unguessable `pay_…` payment id is the capability, exactly
//! like the Next.js hosted-checkout flow.

use std::collections::BTreeMap;

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::oid::ObjectId;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;
use serde_json::Value;

use crate::dto::*;
use crate::{payu, store, webhooks};

const DEFAULT_BUSINESS_NAME: &str = "My business";

fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

fn append_redirect(base: &str, payment_id: &str, status: &str) -> String {
    let sep = if base.contains('?') { '&' } else { '?' };
    format!("{base}{sep}sabpay_payment_id={payment_id}&sabpay_status={status}")
}

fn vstr(v: &Value, k: &str) -> String {
    v.get(k).and_then(Value::as_str).unwrap_or("").to_owned()
}

/* ── dashboard: overview / merchant / stats ──────────────────────────────── */

pub async fn overview(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<OverviewOut>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_BUSINESS_NAME).await?;
    let stats = store::stats(&mongo, uid, &merchant.mode).await?;
    let recent = store::list_payments(&mongo, uid, &merchant.mode, None, None, 8).await?;
    Ok(Json(OverviewOut {
        merchant,
        stats,
        recent,
    }))
}

pub async fn get_merchant(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<MerchantOut>> {
    let uid = user_oid(&user)?;
    Ok(Json(
        store::get_or_create_merchant(&mongo, uid, DEFAULT_BUSINESS_NAME).await?,
    ))
}

pub async fn update_merchant(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<UpdateMerchantBody>,
) -> Result<Json<MerchantOut>> {
    let uid = user_oid(&user)?;
    Ok(Json(store::update_merchant(&mongo, uid, body).await?))
}

pub async fn get_stats(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<StatsOut>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_BUSINESS_NAME).await?;
    Ok(Json(store::stats(&mongo, uid, &merchant.mode).await?))
}

/* ── dashboard: payments ─────────────────────────────────────────────────── */

#[derive(Debug, Deserialize)]
pub struct PaymentsQuery {
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub before: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, serde::Serialize)]
pub struct PaymentsList {
    pub merchant: MerchantOut,
    pub payments: Vec<PaymentOut>,
}

pub async fn list_payments(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<PaymentsQuery>,
) -> Result<Json<PaymentsList>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_BUSINESS_NAME).await?;
    let mode = q.mode.as_deref().unwrap_or(&merchant.mode).to_owned();
    let payments = store::list_payments(
        &mongo,
        uid,
        &mode,
        q.status.as_deref(),
        q.before.as_deref(),
        q.limit.unwrap_or(50),
    )
    .await?;
    Ok(Json(PaymentsList { merchant, payments }))
}

pub async fn create_payment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreatePaymentBody>,
) -> Result<Json<PaymentOut>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_BUSINESS_NAME).await?;
    let mode = match body.mode.as_deref() {
        Some(m @ ("test" | "live")) => m.to_owned(),
        _ => merchant.mode.clone(),
    };
    let payment = store::create_payment(&mongo, uid, &mode, body).await?;

    tokio::spawn(webhooks::dispatch(
        mongo.clone(),
        uid,
        "payment.created".to_owned(),
        payment.clone(),
        mode,
    ));

    Ok(Json(payment))
}

pub async fn get_payment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<PaymentOut>> {
    let uid = user_oid(&user)?;
    let doc = store::get_payment_doc_by_id(&mongo, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No payment \"{id}\".")))?;
    let owner = doc.get_object_id("userId").ok();
    if owner != Some(uid) {
        return Err(ApiError::NotFound(format!("No payment \"{id}\".")));
    }
    Ok(Json(store::doc_to_payment(&doc)))
}

/* ── dashboard: api keys ─────────────────────────────────────────────────── */

pub async fn list_keys(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<Vec<ApiKeyOut>>> {
    let uid = user_oid(&user)?;
    Ok(Json(store::list_keys(&mongo, uid).await?))
}

pub async fn create_key(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateKeyBody>,
) -> Result<Json<ApiKeyOut>> {
    let uid = user_oid(&user)?;
    Ok(Json(store::create_key(&mongo, uid, &body.name, &body.mode).await?))
}

pub async fn revoke_key(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<Ack>> {
    let uid = user_oid(&user)?;
    if store::revoke_key(&mongo, uid, &id).await? {
        Ok(Json(Ack::ok()))
    } else {
        Err(ApiError::NotFound("Key not found.".to_owned()))
    }
}

/* ── dashboard: webhooks ─────────────────────────────────────────────────── */

pub async fn list_webhooks(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<WebhookDataOut>> {
    let uid = user_oid(&user)?;
    let endpoints = store::list_endpoints(&mongo, uid).await?;
    let deliveries = store::list_deliveries(&mongo, uid, 50).await?;
    Ok(Json(WebhookDataOut {
        endpoints,
        deliveries,
    }))
}

pub async fn create_webhook(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateWebhookBody>,
) -> Result<Json<WebhookEndpointOut>> {
    let uid = user_oid(&user)?;
    Ok(Json(store::create_endpoint(&mongo, uid, body).await?))
}

pub async fn update_webhook(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateWebhookBody>,
) -> Result<Json<WebhookEndpointOut>> {
    let uid = user_oid(&user)?;
    store::update_endpoint(&mongo, uid, &id, body)
        .await?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("Endpoint not found.".to_owned()))
}

pub async fn rotate_webhook(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<WebhookEndpointOut>> {
    let uid = user_oid(&user)?;
    store::rotate_endpoint_secret(&mongo, uid, &id)
        .await?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("Endpoint not found.".to_owned()))
}

pub async fn delete_webhook(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<Ack>> {
    let uid = user_oid(&user)?;
    if store::delete_endpoint(&mongo, uid, &id).await? {
        Ok(Json(Ack::ok()))
    } else {
        Err(ApiError::NotFound("Endpoint not found.".to_owned()))
    }
}

/* ── public: hosted checkout ─────────────────────────────────────────────── */

pub async fn public_get_payment(
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<CheckoutView>> {
    let doc = store::get_payment_doc_by_id(&mongo, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Payment not found.".to_owned()))?;
    let p = store::doc_to_payment(&doc);
    let owner = doc
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("payment missing userId")))?;
    let business = store::merchant_branding(&mongo, owner).await;
    Ok(Json(CheckoutView {
        payment_id: p.id,
        mode: p.mode,
        status: p.status,
        amount: p.amount,
        currency: p.currency,
        description: p.description,
        customer_name: p.customer.name.unwrap_or_default(),
        customer_email: p.customer.email.unwrap_or_default(),
        customer_phone: p.customer.phone.unwrap_or_default(),
        success_url: p.success_url,
        cancel_url: p.cancel_url,
        failure_reason: p.failure_reason,
        business,
    }))
}

pub async fn public_payu_session(
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<PayuSessionBody>,
) -> Result<Json<PayuSessionOut>> {
    let doc = store::get_payment_doc_by_id(&mongo, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Payment not found.".to_owned()))?;
    let p = store::doc_to_payment(&doc);
    if p.status != "created" {
        return Err(ApiError::Conflict("This payment is already finished.".to_owned()));
    }
    if p.mode != "live" {
        return Err(ApiError::BadRequest(
            "Test payments use the simulator, not PayU.".to_owned(),
        ));
    }
    let cfg = payu::config().ok_or_else(|| {
        ApiError::BadRequest("Payments are temporarily unavailable. Please try again later.".to_owned())
    })?;

    let name: String = body.name.trim().chars().take(60).collect();
    let email: String = body.email.trim().chars().take(200).collect();
    let phone: String = body.phone.trim().chars().take(15).collect();
    if name.is_empty() {
        return Err(ApiError::BadRequest("Please enter your name.".to_owned()));
    }
    let email_ok = email.contains('@')
        && email
            .split('@')
            .nth(1)
            .map(|d| d.contains('.'))
            .unwrap_or(false);
    if !email_ok {
        return Err(ApiError::BadRequest("Please enter a valid email.".to_owned()));
    }
    if phone.len() != 10 || !phone.chars().all(|c| c.is_ascii_digit()) {
        return Err(ApiError::BadRequest(
            "Please enter a valid 10-digit mobile number.".to_owned(),
        ));
    }

    store::set_payment_customer(&mongo, &id, Some(&name), Some(&email), Some(&phone)).await?;

    let amount = payu::format_amount_paise(p.amount);
    let productinfo = payu::safe_productinfo(&p.description);
    let txnid = p.provider_txn_id.unwrap_or_default();
    let surl = format!("{}/api/sabpay/callback/payu", store::app_url());
    let udf1 = p.id.clone();
    let udf2 = "sabpay".to_owned();

    let hash = payu::build_request_hash(
        &payu::RequestHashInput {
            key: &cfg.key,
            txnid: &txnid,
            amount: &amount,
            productinfo: &productinfo,
            firstname: &name,
            email: &email,
            udf1: &udf1,
            udf2: &udf2,
        },
        &cfg.salt,
    );

    let mut fields: BTreeMap<String, String> = BTreeMap::new();
    fields.insert("key".to_owned(), cfg.key.clone());
    fields.insert("txnid".to_owned(), txnid);
    fields.insert("amount".to_owned(), amount);
    fields.insert("productinfo".to_owned(), productinfo);
    fields.insert("firstname".to_owned(), name);
    fields.insert("email".to_owned(), email);
    fields.insert("phone".to_owned(), phone);
    fields.insert("surl".to_owned(), surl.clone());
    fields.insert("furl".to_owned(), surl);
    fields.insert("udf1".to_owned(), udf1);
    fields.insert("udf2".to_owned(), udf2);
    fields.insert("hash".to_owned(), hash);

    Ok(Json(PayuSessionOut {
        action: cfg.action,
        fields,
    }))
}

pub async fn public_simulate(
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<SimulateBody>,
) -> Result<Json<FinalizeOut>> {
    let doc = store::get_payment_doc_by_id(&mongo, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Payment not found.".to_owned()))?;
    let p = store::doc_to_payment(&doc);
    if p.mode != "test" {
        return Err(ApiError::BadRequest(
            "Only test payments can be simulated.".to_owned(),
        ));
    }
    if p.status != "created" {
        return Err(ApiError::Conflict("This payment is already finished.".to_owned()));
    }

    let name = body.name.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let email = body.email.as_deref().map(str::trim).filter(|s| !s.is_empty());
    if name.is_some() || email.is_some() {
        store::set_payment_customer(&mongo, &id, name, email, None).await?;
    }

    let succeeded = body.outcome == "success";
    let txn = p.provider_txn_id.clone().unwrap_or_default();
    let sim_id = format!("sim_{txn}");
    let updated = store::finalize_payment(
        &mongo,
        &id,
        store::FinalizeInput {
            succeeded,
            provider_payment_id: Some(&sim_id),
            provider_payment_mode: Some("SIMULATED"),
            provider_bank_ref_num: None,
            provider_error_message: None,
            failure_reason: if succeeded { None } else { Some("simulated_failure") },
        },
    )
    .await?
    .ok_or_else(|| ApiError::Conflict("This payment is already finished.".to_owned()))?;

    let out = store::doc_to_payment(&updated);
    let uid = updated
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("payment missing userId")))?;
    tokio::spawn(webhooks::dispatch(
        mongo.clone(),
        uid,
        if succeeded { "payment.succeeded" } else { "payment.failed" }.to_owned(),
        out.clone(),
        out.mode.clone(),
    ));

    let redirect_base = if succeeded { out.success_url.clone() } else { out.cancel_url.clone() };
    let redirect_url = redirect_base.map(|b| append_redirect(&b, &out.id, &out.status));

    Ok(Json(FinalizeOut {
        status: out.status,
        payment_id: out.id,
        redirect_url,
    }))
}

pub async fn public_callback(
    State(mongo): State<MongoHandle>,
    Json(form): Json<Value>,
) -> Result<Json<FinalizeOut>> {
    let cfg = payu::config().ok_or_else(|| {
        ApiError::BadRequest("PayU is not configured.".to_owned())
    })?;

    let txnid = vstr(&form, "txnid");
    if txnid.is_empty() {
        return Err(ApiError::BadRequest("Missing txnid.".to_owned()));
    }

    let fields = payu::ResponseFields {
        status: vstr(&form, "status"),
        key: vstr(&form, "key"),
        txnid: txnid.clone(),
        amount: vstr(&form, "amount"),
        productinfo: vstr(&form, "productinfo"),
        firstname: vstr(&form, "firstname"),
        email: vstr(&form, "email"),
        udf1: vstr(&form, "udf1"),
        udf2: vstr(&form, "udf2"),
        udf3: vstr(&form, "udf3"),
        udf4: vstr(&form, "udf4"),
        udf5: vstr(&form, "udf5"),
        udf6: vstr(&form, "udf6"),
        udf7: vstr(&form, "udf7"),
        udf8: vstr(&form, "udf8"),
        udf9: vstr(&form, "udf9"),
        udf10: vstr(&form, "udf10"),
        hash: vstr(&form, "hash"),
    };

    if !payu::verify_response_hash(&fields, &cfg.salt) {
        return Err(ApiError::BadRequest("Payment verification failed.".to_owned()));
    }

    let payment_doc = store::get_payment_doc_by_txn(&mongo, &txnid)
        .await?
        .ok_or_else(|| ApiError::NotFound("Unknown transaction.".to_owned()))?;
    let payment_id = store::doc_to_payment(&payment_doc).id;

    let succeeded = fields.status.to_lowercase() == "success";
    let error_message = {
        let m = vstr(&form, "error_Message");
        if m.is_empty() {
            let m2 = vstr(&form, "error_message");
            if m2.is_empty() { None } else { Some(m2) }
        } else {
            Some(m)
        }
    };
    let mihpayid = vstr(&form, "mihpayid");
    let mode_field = vstr(&form, "mode");
    let bank_ref = vstr(&form, "bank_ref_num");

    let updated = store::finalize_payment(
        &mongo,
        &payment_id,
        store::FinalizeInput {
            succeeded,
            provider_payment_id: if mihpayid.is_empty() { None } else { Some(&mihpayid) },
            provider_payment_mode: if mode_field.is_empty() { None } else { Some(&mode_field) },
            provider_bank_ref_num: if bank_ref.is_empty() { None } else { Some(&bank_ref) },
            provider_error_message: error_message.as_deref(),
            failure_reason: if succeeded {
                None
            } else if fields.status.is_empty() {
                Some("failed")
            } else {
                Some(fields.status.as_str())
            },
        },
    )
    .await?;

    if let Some(updated_doc) = updated {
        let out = store::doc_to_payment(&updated_doc);
        let uid = updated_doc
            .get_object_id("userId")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("payment missing userId")))?;
        tokio::spawn(webhooks::dispatch(
            mongo.clone(),
            uid,
            if succeeded { "payment.succeeded" } else { "payment.failed" }.to_owned(),
            out.clone(),
            out.mode.clone(),
        ));
        let redirect_base = if succeeded { out.success_url.clone() } else { out.cancel_url.clone() };
        let redirect_url = redirect_base.map(|b| append_redirect(&b, &out.id, &out.status));
        return Ok(Json(FinalizeOut {
            status: out.status,
            payment_id: out.id,
            redirect_url,
        }));
    }

    // Already finalized (PayU retried) — redirect using the stored status.
    let out = store::doc_to_payment(&payment_doc);
    let already_succeeded = out.status == "succeeded";
    let redirect_base = if already_succeeded { out.success_url.clone() } else { out.cancel_url.clone() };
    let redirect_url = redirect_base.map(|b| append_redirect(&b, &out.id, &out.status));
    Ok(Json(FinalizeOut {
        status: out.status,
        payment_id: out.id,
        redirect_url,
    }))
}
