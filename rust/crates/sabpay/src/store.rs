//! Mongo persistence for SabPay.
//!
//! Collections (shared verbatim with the Next.js `src/lib/sabpay/*` impl):
//!   - `sabpay_merchants`           one settings doc per user
//!   - `sabpay_payments`            payment sessions
//!   - `sabpay_api_keys`            SHA-256-hashed secret keys
//!   - `sabpay_webhook_endpoints`   outbound endpoints
//!   - `sabpay_webhook_deliveries`  delivery log
//!
//! Document shapes match the TS side exactly: `userId` / `_id` are `ObjectId`,
//! timestamps are ISO-8601 **strings** (`new Date().toISOString()` format), and
//! amounts are integer paise. Reads use tolerant getters so a value the Node
//! driver wrote as a BSON double (rather than int32) still parses.

use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{Days, SecondsFormat, Utc};
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::dto::*;

pub const MERCHANTS: &str = "sabpay_merchants";
pub const PAYMENTS: &str = "sabpay_payments";
pub const KEYS: &str = "sabpay_api_keys";
pub const ENDPOINTS: &str = "sabpay_webhook_endpoints";
pub const DELIVERIES: &str = "sabpay_webhook_deliveries";

pub const WEBHOOK_EVENTS: &[&str] = &[
    "payment.created",
    "payment.succeeded",
    "payment.failed",
];
pub const MAX_CONSECUTIVE_FAILURES: i64 = 10;
const PAYMENT_CAP_PAISE: i64 = 100_000_000; // ₹10,00,000

/* ── small helpers ───────────────────────────────────────────────────────── */

/// ISO-8601 with millisecond precision + `Z`, byte-identical to JS
/// `new Date().toISOString()`.
pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// `n` random bytes, lower-case hex.
pub fn random_hex(n: usize) -> String {
    let mut bytes = vec![0u8; n];
    for b in bytes.iter_mut() {
        *b = rand::random();
    }
    hex::encode(bytes)
}

/// SHA-256 hex of the full secret — matches the Next.js `hashSecret`.
pub fn sha256_hex(input: &str) -> String {
    let mut h = Sha256::new();
    h.update(input.as_bytes());
    hex::encode(h.finalize())
}

/// Base URL of the Next.js app (hosted-checkout links + PayU callbacks).
pub fn app_url() -> String {
    std::env::var("NEXT_PUBLIC_APP_URL")
        .or_else(|_| std::env::var("APP_URL"))
        .ok()
        .map(|s| s.trim_end_matches('/').to_owned())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "http://localhost:3002".to_owned())
}

fn num_i64(d: &Document, k: &str) -> i64 {
    match d.get(k) {
        Some(Bson::Int32(n)) => *n as i64,
        Some(Bson::Int64(n)) => *n,
        Some(Bson::Double(n)) => *n as i64,
        _ => 0,
    }
}

fn num_opt_i64(d: &Document, k: &str) -> Option<i64> {
    match d.get(k) {
        Some(Bson::Int32(n)) => Some(*n as i64),
        Some(Bson::Int64(n)) => Some(*n),
        Some(Bson::Double(n)) => Some(*n as i64),
        _ => None,
    }
}

fn str_opt(d: &Document, k: &str) -> Option<String> {
    match d.get(k) {
        Some(Bson::String(s)) if !s.is_empty() => Some(s.clone()),
        _ => None,
    }
}

fn str_or(d: &Document, k: &str, default: &str) -> String {
    str_opt(d, k).unwrap_or_else(|| default.to_owned())
}

fn bool_or(d: &Document, k: &str, default: bool) -> bool {
    d.get_bool(k).unwrap_or(default)
}

/// Timestamp getter that tolerates both ISO strings (what we write) and BSON
/// dates (in case an older doc stored one).
fn iso_opt(d: &Document, k: &str) -> Option<String> {
    match d.get(k) {
        Some(Bson::String(s)) if !s.is_empty() => Some(s.clone()),
        Some(Bson::DateTime(dt)) => dt.try_to_rfc3339_string().ok(),
        _ => None,
    }
}

fn metadata_opt(d: &Document) -> Option<Value> {
    match d.get("metadata") {
        Some(b) if !matches!(b, Bson::Null) => {
            let v = bson_to_clean_json(b.clone());
            if v.is_null() { None } else { Some(v) }
        }
        _ => None,
    }
}

fn valid_http_url(url: &str) -> bool {
    let u = url.trim();
    u.starts_with("http://") || u.starts_with("https://")
}

fn valid_hex_color(c: &str) -> bool {
    c.len() == 7
        && c.starts_with('#')
        && c[1..].chars().all(|ch| ch.is_ascii_hexdigit())
}

/* ── doc → DTO mappers ───────────────────────────────────────────────────── */

pub fn doc_to_payment(d: &Document) -> PaymentOut {
    let payment_id = str_or(d, "paymentId", "");
    PaymentOut {
        id: payment_id.clone(),
        mode: str_or(d, "mode", "test"),
        status: str_or(d, "status", "created"),
        amount: num_i64(d, "amount"),
        currency: str_or(d, "currency", "INR"),
        description: str_or(d, "description", "Payment"),
        customer: CustomerOut {
            name: str_opt(d, "customerName"),
            email: str_opt(d, "customerEmail"),
            phone: str_opt(d, "customerPhone"),
        },
        metadata: metadata_opt(d),
        success_url: str_opt(d, "successUrl"),
        cancel_url: str_opt(d, "cancelUrl"),
        checkout_url: format!("{}/pay/{}", app_url(), payment_id),
        provider: str_or(d, "provider", "payu"),
        provider_txn_id: str_opt(d, "providerTxnId"),
        provider_payment_id: str_opt(d, "providerPaymentId"),
        provider_meta: ProviderMetaOut {
            payment_mode: str_opt(d, "providerPaymentMode"),
            bank_ref_num: str_opt(d, "providerBankRefNum"),
            error_message: str_opt(d, "providerErrorMessage"),
        },
        failure_reason: str_opt(d, "failureReason"),
        created_at: iso_opt(d, "createdAt").unwrap_or_else(now_iso),
        paid_at: iso_opt(d, "paidAt"),
    }
}

fn doc_to_merchant(d: &Document) -> MerchantOut {
    MerchantOut {
        business_name: str_or(d, "businessName", "My business"),
        logo_url: str_opt(d, "logoUrl"),
        brand_color: str_opt(d, "brandColor"),
        mode: str_or(d, "mode", "test"),
        default_currency: str_or(d, "defaultCurrency", "INR"),
        created_at: iso_opt(d, "createdAt").unwrap_or_else(now_iso),
    }
}

fn doc_to_key(d: &Document, secret: Option<String>) -> ApiKeyOut {
    ApiKeyOut {
        id: d.get_object_id("_id").map(|o| o.to_hex()).unwrap_or_default(),
        name: str_or(d, "name", "Secret key"),
        mode: str_or(d, "mode", "test"),
        display: str_or(d, "display", ""),
        revoked: bool_or(d, "revoked", false),
        last_used_at: iso_opt(d, "lastUsedAt"),
        created_at: iso_opt(d, "createdAt").unwrap_or_else(now_iso),
        secret,
    }
}

pub fn doc_to_endpoint(d: &Document, reveal_secret: bool) -> WebhookEndpointOut {
    let events: Vec<String> = d
        .get_array("events")
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();
    let secret = str_opt(d, "secret");
    WebhookEndpointOut {
        id: d.get_object_id("_id").map(|o| o.to_hex()).unwrap_or_default(),
        url: str_or(d, "url", ""),
        events,
        description: str_opt(d, "description"),
        active: bool_or(d, "active", true),
        failure_count: num_i64(d, "failureCount"),
        last_delivery_at: iso_opt(d, "lastDeliveryAt"),
        last_status: num_opt_i64(d, "lastStatus"),
        last_error: str_opt(d, "lastError"),
        has_secret: secret.is_some(),
        secret: if reveal_secret { secret } else { None },
        created_at: iso_opt(d, "createdAt").unwrap_or_else(now_iso),
    }
}

fn doc_to_delivery(d: &Document) -> WebhookDeliveryOut {
    WebhookDeliveryOut {
        id: d.get_object_id("_id").map(|o| o.to_hex()).unwrap_or_default(),
        endpoint_id: d.get_object_id("endpointId").map(|o| o.to_hex()).unwrap_or_default(),
        url: str_or(d, "url", ""),
        event: str_or(d, "event", ""),
        payment_id: str_or(d, "paymentId", ""),
        success: bool_or(d, "success", false),
        status: num_opt_i64(d, "status"),
        attempts: num_i64(d, "attempts"),
        error: str_opt(d, "error"),
        created_at: iso_opt(d, "createdAt").unwrap_or_else(now_iso),
    }
}

/* ── merchants ───────────────────────────────────────────────────────────── */

/// Fetch (auto-creating on first use) the merchant settings for a user.
pub async fn get_or_create_merchant(
    mongo: &MongoHandle,
    uid: ObjectId,
    fallback_name: &str,
) -> Result<MerchantOut> {
    let coll = mongo.collection::<Document>(MERCHANTS);
    if let Some(d) = coll
        .find_one(doc! { "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.merchant.find")))?
    {
        return Ok(doc_to_merchant(&d));
    }

    let now = now_iso();
    let name = if fallback_name.trim().is_empty() {
        "My business".to_owned()
    } else {
        fallback_name.trim().chars().take(120).collect()
    };
    let new = doc! {
        "_id": ObjectId::new(),
        "userId": uid,
        "businessName": &name,
        "mode": "test",
        "defaultCurrency": "INR",
        "createdAt": &now,
        "updatedAt": &now,
    };
    // Upsert-guard: if a concurrent request inserted first, fall back to a read.
    match coll.insert_one(&new).await {
        Ok(_) => Ok(doc_to_merchant(&new)),
        Err(_) => {
            let d = coll
                .find_one(doc! { "userId": uid })
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("sabpay.merchant.refind"))
                })?
                .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("merchant insert race")))?;
            Ok(doc_to_merchant(&d))
        }
    }
}

pub async fn get_merchant_doc(mongo: &MongoHandle, uid: ObjectId) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(MERCHANTS)
        .find_one(doc! { "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.merchant.doc")))
}

/// Merchant branding for the hosted checkout, by the payment's owning user.
pub async fn merchant_branding(mongo: &MongoHandle, uid: ObjectId) -> CheckoutBusiness {
    let doc = get_merchant_doc(mongo, uid).await.ok().flatten();
    let name = doc
        .as_ref()
        .and_then(|d| str_opt(d, "businessName"))
        .unwrap_or_else(|| "SabPay merchant".to_owned());
    let logo_url = doc.as_ref().and_then(|d| str_opt(d, "logoUrl"));
    let brand_color = doc
        .as_ref()
        .and_then(|d| str_opt(d, "brandColor"))
        .unwrap_or_else(|| "#4f46e5".to_owned());
    CheckoutBusiness {
        name,
        logo_url,
        brand_color,
    }
}

pub async fn update_merchant(
    mongo: &MongoHandle,
    uid: ObjectId,
    body: UpdateMerchantBody,
) -> Result<MerchantOut> {
    // Ensure a row exists first (parity with the dashboard's get-or-create).
    get_or_create_merchant(mongo, uid, "My business").await?;

    let mut set = doc! { "updatedAt": now_iso() };
    if let Some(name) = body.business_name {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("Business name is required.".to_owned()));
        }
        set.insert("businessName", trimmed.chars().take(120).collect::<String>());
    }
    if let Some(logo) = body.logo_url {
        let t = logo.trim();
        if t.is_empty() {
            set.insert("logoUrl", Bson::Null);
        } else {
            set.insert("logoUrl", t);
        }
    }
    if let Some(color) = body.brand_color {
        let t = color.trim();
        if t.is_empty() {
            set.insert("brandColor", Bson::Null);
        } else if valid_hex_color(t) {
            set.insert("brandColor", t);
        } else {
            return Err(ApiError::Validation(
                "Brand color must be a 6-digit hex value.".to_owned(),
            ));
        }
    }
    if let Some(mode) = body.mode {
        if mode != "test" && mode != "live" {
            return Err(ApiError::Validation("Mode must be test or live.".to_owned()));
        }
        set.insert("mode", mode);
    }

    let coll = mongo.collection::<Document>(MERCHANTS);
    coll.update_one(doc! { "userId": uid }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.merchant.update")))?;
    let d = get_merchant_doc(mongo, uid)
        .await?
        .ok_or_else(|| ApiError::NotFound("Merchant not found.".to_owned()))?;
    Ok(doc_to_merchant(&d))
}

/* ── payments ────────────────────────────────────────────────────────────── */

/// Create a payment session for `uid`. `mode` is the resolved mode (key prefix
/// for the API, merchant mode for the dashboard).
pub async fn create_payment(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    body: CreatePaymentBody,
) -> Result<PaymentOut> {
    if body.amount < 100 {
        return Err(ApiError::BadRequest(
            "amount must be an integer in paise, at least 100 (₹1).".to_owned(),
        ));
    }
    if body.amount > PAYMENT_CAP_PAISE {
        return Err(ApiError::BadRequest(
            "amount exceeds the per-payment cap of ₹10,00,000.".to_owned(),
        ));
    }
    let currency = body
        .currency
        .as_deref()
        .unwrap_or("INR")
        .to_uppercase();
    if currency != "INR" {
        return Err(ApiError::BadRequest(
            "Only INR is supported on the PayU rail right now.".to_owned(),
        ));
    }

    let mut metadata_bson: Option<Bson> = None;
    if let Some(Value::Object(map)) = &body.metadata {
        if map.len() > 20 {
            return Err(ApiError::BadRequest(
                "metadata supports at most 20 keys.".to_owned(),
            ));
        }
        for (k, v) in map {
            let ok = v.as_str().is_some_and(|s| s.len() <= 500) && k.len() <= 40;
            if !ok {
                return Err(ApiError::BadRequest(
                    "metadata values must be strings (key ≤ 40, value ≤ 500 chars).".to_owned(),
                ));
            }
        }
        metadata_bson = bson::to_bson(&body.metadata).ok();
    }

    let payment_id = format!("pay_{}", random_hex(12));
    let provider_txn_id = format!("sp{}", random_hex(10));
    let now = now_iso();
    let description = {
        let d = body.description.unwrap_or_default();
        let t = d.trim();
        if t.is_empty() {
            "Payment".to_owned()
        } else {
            t.chars().take(200).collect()
        }
    };

    let mut d = doc! {
        "_id": ObjectId::new(),
        "paymentId": &payment_id,
        "userId": uid,
        "mode": mode,
        "status": "created",
        "amount": body.amount,
        "currency": &currency,
        "description": &description,
        "provider": "payu",
        "providerTxnId": &provider_txn_id,
        "createdAt": &now,
        "updatedAt": &now,
    };

    if let Some(c) = &body.customer {
        if let Some(n) = c.name.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            d.insert("customerName", n.chars().take(100).collect::<String>());
        }
        if let Some(e) = c.email.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            d.insert("customerEmail", e.chars().take(200).collect::<String>());
        }
        if let Some(p) = c.phone.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            d.insert("customerPhone", p.chars().take(20).collect::<String>());
        }
    }
    if let Some(m) = metadata_bson {
        d.insert("metadata", m);
    }
    if let Some(u) = body.success_url.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        if !valid_http_url(u) {
            return Err(ApiError::BadRequest("success_url must use http or https.".to_owned()));
        }
        d.insert("successUrl", u);
    }
    if let Some(u) = body.cancel_url.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        if !valid_http_url(u) {
            return Err(ApiError::BadRequest("cancel_url must use http or https.".to_owned()));
        }
        d.insert("cancelUrl", u);
    }

    mongo
        .collection::<Document>(PAYMENTS)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment.insert")))?;
    Ok(doc_to_payment(&d))
}

pub async fn get_payment_doc_by_id(
    mongo: &MongoHandle,
    payment_id: &str,
) -> Result<Option<Document>> {
    if !payment_id.starts_with("pay_") {
        return Ok(None);
    }
    mongo
        .collection::<Document>(PAYMENTS)
        .find_one(doc! { "paymentId": payment_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment.by_id")))
}

pub async fn get_payment_doc_by_txn(
    mongo: &MongoHandle,
    txnid: &str,
) -> Result<Option<Document>> {
    if txnid.is_empty() {
        return Ok(None);
    }
    mongo
        .collection::<Document>(PAYMENTS)
        .find_one(doc! { "providerTxnId": txnid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment.by_txn")))
}

pub async fn list_payments(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    status: Option<&str>,
    before: Option<&str>,
    limit: i64,
) -> Result<Vec<PaymentOut>> {
    let mut filter = doc! { "userId": uid, "mode": mode };
    if let Some(s) = status {
        filter.insert("status", s);
    }
    if let Some(b) = before {
        filter.insert("createdAt", doc! { "$lt": b });
    }
    let limit = limit.clamp(1, 100);
    let cursor = mongo
        .collection::<Document>(PAYMENTS)
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(limit)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment.collect")))?;
    Ok(docs.iter().map(doc_to_payment).collect())
}

/// Persist the customer details the checkout page collected before signing.
pub async fn set_payment_customer(
    mongo: &MongoHandle,
    payment_id: &str,
    name: Option<&str>,
    email: Option<&str>,
    phone: Option<&str>,
) -> Result<()> {
    let mut set = doc! { "updatedAt": now_iso() };
    if let Some(n) = name.filter(|s| !s.is_empty()) {
        set.insert("customerName", n);
    }
    if let Some(e) = email.filter(|s| !s.is_empty()) {
        set.insert("customerEmail", e);
    }
    if let Some(p) = phone.filter(|s| !s.is_empty()) {
        set.insert("customerPhone", p);
    }
    mongo
        .collection::<Document>(PAYMENTS)
        .update_one(doc! { "paymentId": payment_id }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment.set_customer")))?;
    Ok(())
}

/// Idempotently transition a payment out of `created`. Returns the updated doc
/// when this call performed the transition, or `None` when it was already
/// finalized (PayU retried) / unknown.
pub struct FinalizeInput<'a> {
    pub succeeded: bool,
    pub provider_payment_id: Option<&'a str>,
    pub provider_payment_mode: Option<&'a str>,
    pub provider_bank_ref_num: Option<&'a str>,
    pub provider_error_message: Option<&'a str>,
    pub failure_reason: Option<&'a str>,
}

pub async fn finalize_payment(
    mongo: &MongoHandle,
    payment_id: &str,
    input: FinalizeInput<'_>,
) -> Result<Option<Document>> {
    let now = now_iso();
    let mut set = doc! {
        "status": if input.succeeded { "succeeded" } else { "failed" },
        "updatedAt": &now,
    };
    if input.succeeded {
        set.insert("paidAt", &now);
    }
    if let Some(v) = input.provider_payment_id {
        set.insert("providerPaymentId", v);
    }
    if let Some(v) = input.provider_payment_mode {
        set.insert("providerPaymentMode", v);
    }
    if let Some(v) = input.provider_bank_ref_num {
        set.insert("providerBankRefNum", v);
    }
    if let Some(v) = input.provider_error_message {
        set.insert("providerErrorMessage", v);
    }
    if !input.succeeded {
        if let Some(v) = input.failure_reason {
            set.insert("failureReason", v);
        }
    }

    let res = mongo
        .collection::<Document>(PAYMENTS)
        .update_one(
            doc! { "paymentId": payment_id, "status": "created" },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.payment.finalize")))?;

    if res.matched_count == 0 {
        return Ok(None);
    }
    get_payment_doc_by_id(mongo, payment_id).await
}

/* ── stats ───────────────────────────────────────────────────────────────── */

pub async fn stats(mongo: &MongoHandle, uid: ObjectId, mode: &str) -> Result<StatsOut> {
    let coll = mongo.collection::<Document>(PAYMENTS);

    let since_date = Utc::now()
        .date_naive()
        .checked_sub_days(Days::new(13))
        .unwrap_or_else(|| Utc::now().date_naive());
    let since_iso = format!("{}T00:00:00.000Z", since_date.format("%Y-%m-%d"));

    let totals_cursor = coll
        .aggregate(vec![
            doc! { "$match": { "userId": uid, "mode": mode } },
            doc! { "$group": {
                "_id": "$status",
                "count": { "$sum": 1_i64 },
                "volume": { "$sum": "$amount" },
            }},
        ])
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.stats.totals")))?;
    let totals: Vec<Document> = totals_cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.stats.totals.collect")))?;

    let daily_cursor = coll
        .aggregate(vec![
            doc! { "$match": {
                "userId": uid,
                "mode": mode,
                "status": "succeeded",
                "createdAt": { "$gte": &since_iso },
            }},
            doc! { "$group": {
                "_id": { "$substrBytes": ["$createdAt", 0, 10] },
                "volume": { "$sum": "$amount" },
                "count": { "$sum": 1_i64 },
            }},
        ])
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.stats.daily")))?;
    let daily: Vec<Document> = daily_cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.stats.daily.collect")))?;

    let mut succeeded_count = 0_i64;
    let mut failed_count = 0_i64;
    let mut created_count = 0_i64;
    let mut total_volume = 0_i64;
    for t in &totals {
        let status = str_or(t, "_id", "");
        let count = num_i64(t, "count");
        match status.as_str() {
            "succeeded" => {
                succeeded_count = count;
                total_volume = num_i64(t, "volume");
            }
            "failed" => failed_count = count,
            "created" => created_count = count,
            _ => {}
        }
    }
    let finished = succeeded_count + failed_count;
    let success_rate = if finished == 0 {
        0
    } else {
        ((succeeded_count as f64 / finished as f64) * 100.0).round() as i64
    };

    let mut by_day: std::collections::HashMap<String, (i64, i64)> = std::collections::HashMap::new();
    for d in &daily {
        let key = str_or(d, "_id", "");
        by_day.insert(key, (num_i64(d, "volume"), num_i64(d, "count")));
    }
    let mut series = Vec::with_capacity(14);
    for i in 0..14u64 {
        let day = since_date
            .checked_add_days(Days::new(i))
            .unwrap_or(since_date);
        let key = day.format("%Y-%m-%d").to_string();
        let (volume, count) = by_day.get(&key).copied().unwrap_or((0, 0));
        series.push(StatsPoint { date: key, volume, count });
    }

    Ok(StatsOut {
        total_volume,
        total_count: succeeded_count + failed_count + created_count,
        succeeded_count,
        failed_count,
        created_count,
        success_rate,
        series,
    })
}

/* ── api keys ────────────────────────────────────────────────────────────── */

pub async fn list_keys(mongo: &MongoHandle, uid: ObjectId) -> Result<Vec<ApiKeyOut>> {
    let cursor = mongo
        .collection::<Document>(KEYS)
        .find(doc! { "userId": uid })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.keys.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.keys.collect")))?;
    Ok(docs.iter().map(|d| doc_to_key(d, None)).collect())
}

pub async fn create_key(
    mongo: &MongoHandle,
    uid: ObjectId,
    name: &str,
    mode: &str,
) -> Result<ApiKeyOut> {
    if mode != "test" && mode != "live" {
        return Err(ApiError::Validation("Mode must be test or live.".to_owned()));
    }
    let trimmed = name.trim();
    let display_name = if trimmed.is_empty() {
        "Secret key".to_owned()
    } else {
        trimmed.chars().take(80).collect()
    };
    let secret = format!("sk_{}_{}", mode, random_hex(24));
    let hash = sha256_hex(&secret);
    let display = format!("sk_{}_…{}", mode, &secret[secret.len() - 4..]);
    let now = now_iso();
    let d = doc! {
        "_id": ObjectId::new(),
        "userId": uid,
        "name": &display_name,
        "mode": mode,
        "hash": &hash,
        "display": &display,
        "revoked": false,
        "createdAt": &now,
    };
    mongo
        .collection::<Document>(KEYS)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.keys.insert")))?;
    Ok(doc_to_key(&d, Some(secret)))
}

pub async fn revoke_key(mongo: &MongoHandle, uid: ObjectId, key_id: &str) -> Result<bool> {
    let oid = ObjectId::parse_str(key_id)
        .map_err(|_| ApiError::BadRequest("Invalid key id.".to_owned()))?;
    let res = mongo
        .collection::<Document>(KEYS)
        .update_one(
            doc! { "_id": oid, "userId": uid },
            doc! { "$set": { "revoked": true } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.keys.revoke")))?;
    Ok(res.modified_count > 0)
}

/* ── webhook endpoints ───────────────────────────────────────────────────── */

fn normalise_events(events: &[String]) -> Result<Vec<String>> {
    if events.is_empty() {
        return Err(ApiError::Validation(format!(
            "Pick at least one event ({}).",
            WEBHOOK_EVENTS.join(", ")
        )));
    }
    let mut out: Vec<String> = Vec::new();
    for e in events {
        if !WEBHOOK_EVENTS.contains(&e.as_str()) {
            return Err(ApiError::Validation(format!("Unknown event \"{e}\".")));
        }
        if !out.contains(e) {
            out.push(e.clone());
        }
    }
    Ok(out)
}

pub async fn list_endpoints(mongo: &MongoHandle, uid: ObjectId) -> Result<Vec<WebhookEndpointOut>> {
    let cursor = mongo
        .collection::<Document>(ENDPOINTS)
        .find(doc! { "userId": uid })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.endpoints.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.endpoints.collect")))?;
    Ok(docs.iter().map(|d| doc_to_endpoint(d, false)).collect())
}

pub async fn create_endpoint(
    mongo: &MongoHandle,
    uid: ObjectId,
    body: CreateWebhookBody,
) -> Result<WebhookEndpointOut> {
    if !valid_http_url(&body.url) {
        return Err(ApiError::Validation("Endpoint URL must use http or https.".to_owned()));
    }
    let events = normalise_events(&body.events)?;
    let now = now_iso();
    let secret = format!("whsec_{}", random_hex(32));
    let mut d = doc! {
        "_id": ObjectId::new(),
        "userId": uid,
        "url": body.url.trim(),
        "events": &events,
        "secret": &secret,
        "active": true,
        "failureCount": 0_i64,
        "createdAt": &now,
        "updatedAt": &now,
    };
    if let Some(desc) = body.description.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        d.insert("description", desc.chars().take(200).collect::<String>());
    }
    mongo
        .collection::<Document>(ENDPOINTS)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.endpoints.insert")))?;
    Ok(doc_to_endpoint(&d, true))
}

pub async fn update_endpoint(
    mongo: &MongoHandle,
    uid: ObjectId,
    id: &str,
    body: UpdateWebhookBody,
) -> Result<Option<WebhookEndpointOut>> {
    let oid = ObjectId::parse_str(id)
        .map_err(|_| ApiError::BadRequest("Invalid endpoint id.".to_owned()))?;
    let mut set = doc! { "updatedAt": now_iso() };
    if let Some(url) = body.url {
        if !valid_http_url(&url) {
            return Err(ApiError::Validation("Endpoint URL must use http or https.".to_owned()));
        }
        set.insert("url", url.trim());
    }
    if let Some(events) = body.events {
        set.insert("events", normalise_events(&events)?);
    }
    if let Some(desc) = body.description {
        let t = desc.trim();
        if t.is_empty() {
            set.insert("description", Bson::Null);
        } else {
            set.insert("description", t.chars().take(200).collect::<String>());
        }
    }
    if let Some(active) = body.active {
        set.insert("active", active);
        if active {
            set.insert("failureCount", 0_i64);
        }
    }
    let coll = mongo.collection::<Document>(ENDPOINTS);
    let res = coll
        .update_one(doc! { "_id": oid, "userId": uid }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.endpoints.update")))?;
    if res.matched_count == 0 {
        return Ok(None);
    }
    let d = coll
        .find_one(doc! { "_id": oid, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.endpoints.reload")))?;
    Ok(d.as_ref().map(|d| doc_to_endpoint(d, false)))
}

pub async fn rotate_endpoint_secret(
    mongo: &MongoHandle,
    uid: ObjectId,
    id: &str,
) -> Result<Option<WebhookEndpointOut>> {
    let oid = ObjectId::parse_str(id)
        .map_err(|_| ApiError::BadRequest("Invalid endpoint id.".to_owned()))?;
    let secret = format!("whsec_{}", random_hex(32));
    let coll = mongo.collection::<Document>(ENDPOINTS);
    let res = coll
        .update_one(
            doc! { "_id": oid, "userId": uid },
            doc! { "$set": { "secret": &secret, "updatedAt": now_iso() } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.endpoints.rotate")))?;
    if res.matched_count == 0 {
        return Ok(None);
    }
    let d = coll
        .find_one(doc! { "_id": oid, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.endpoints.rotate.reload")))?;
    Ok(d.as_ref().map(|d| doc_to_endpoint(d, true)))
}

pub async fn delete_endpoint(mongo: &MongoHandle, uid: ObjectId, id: &str) -> Result<bool> {
    let oid = ObjectId::parse_str(id)
        .map_err(|_| ApiError::BadRequest("Invalid endpoint id.".to_owned()))?;
    let res = mongo
        .collection::<Document>(ENDPOINTS)
        .delete_one(doc! { "_id": oid, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.endpoints.delete")))?;
    Ok(res.deleted_count == 1)
}

pub async fn list_deliveries(
    mongo: &MongoHandle,
    uid: ObjectId,
    limit: i64,
) -> Result<Vec<WebhookDeliveryOut>> {
    let cursor = mongo
        .collection::<Document>(DELIVERIES)
        .find(doc! { "userId": uid })
        .sort(doc! { "createdAt": -1 })
        .limit(limit.clamp(1, 200))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.deliveries.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.deliveries.collect")))?;
    Ok(docs.iter().map(doc_to_delivery).collect())
}
