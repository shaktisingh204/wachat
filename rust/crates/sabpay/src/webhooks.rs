//! SabPay outbound webhooks — HMAC-SHA256 signing + retrying delivery.
//!
//! EXTERNAL SEAM: the only module that makes outbound HTTP calls to merchant
//! endpoints. Mirrors the wachat-razorpay client (reqwest + rustls). For each
//! subscribed, active endpoint we POST a signed JSON envelope:
//!
//!   POST <endpoint url>
//!   X-SabNode-Signature: sha256=<hmac of the raw body>
//!   X-SabNode-Event: payment.succeeded
//!
//! Delivery retries 5× with exponential backoff (0.5s → 8s, capped 30s) on
//! transport errors and 408/429/5xx. Endpoints auto-disable after
//! `MAX_CONSECUTIVE_FAILURES`; every attempt is appended to
//! `sabpay_webhook_deliveries`. Dispatch never blocks the caller — handlers
//! `tokio::spawn` it.

use std::time::Duration;

use bson::{Bson, Document, doc, oid::ObjectId};
use hmac::{Hmac, Mac};
use sabnode_db::mongo::MongoHandle;
use sha2::Sha256;

use crate::dto::PaymentOut;
use crate::store;

type HmacSha256 = Hmac<Sha256>;

const MAX_ATTEMPTS: i64 = 5;
const BASE_DELAY_MS: u64 = 500;
const MAX_DELAY_MS: u64 = 30_000;
const TIMEOUT_SECS: u64 = 15;

/// `sha256=<hex>` HMAC over the exact body bytes — the format merchant SDKs
/// (and the Next.js verifier) expect in `X-SabNode-Signature`.
pub fn sign(secret: &str, body: &str) -> String {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(secret.as_bytes())
        .expect("HMAC accepts a key of any length");
    mac.update(body.as_bytes());
    format!("sha256={}", hex::encode(mac.finalize().into_bytes()))
}

struct Outcome {
    success: bool,
    status: Option<i64>,
    attempts: i64,
    error: Option<String>,
}

fn backoff_ms(attempt: i64) -> u64 {
    let shift = (attempt - 1).clamp(0, 16) as u32;
    (BASE_DELAY_MS.saturating_mul(1u64 << shift)).min(MAX_DELAY_MS)
}

async fn deliver(url: &str, body: &str, signature: &str, event: &str) -> Outcome {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return Outcome {
                success: false,
                status: None,
                attempts: 0,
                error: Some(format!("client build: {e}")),
            };
        }
    };

    let mut attempts = 0;
    let mut last_status: Option<i64> = None;
    let mut last_error: Option<String> = None;

    for i in 1..=MAX_ATTEMPTS {
        attempts = i;
        let resp = client
            .post(url)
            .header("content-type", "application/json")
            .header("user-agent", "SabPay-Webhooks/1.0")
            .header("x-sabnode-signature", signature)
            .header("x-sabnode-event", event)
            .header("x-sabnode-delivery", store::random_hex(16))
            .body(body.to_owned())
            .send()
            .await;

        match resp {
            Ok(r) => {
                let code = r.status().as_u16() as i64;
                last_status = Some(code);
                last_error = None;
                if (200..300).contains(&code) {
                    return Outcome {
                        success: true,
                        status: Some(code),
                        attempts: i,
                        error: None,
                    };
                }
                let retryable = code == 408 || code == 429 || (500..600).contains(&code);
                if !retryable || i == MAX_ATTEMPTS {
                    return Outcome {
                        success: false,
                        status: Some(code),
                        attempts: i,
                        error: None,
                    };
                }
            }
            Err(e) => {
                last_status = None;
                last_error = Some(e.to_string());
                if i == MAX_ATTEMPTS {
                    break;
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(backoff_ms(i))).await;
    }

    Outcome {
        success: false,
        status: last_status,
        attempts,
        error: last_error,
    }
}

fn prev_failures(ep: &Document) -> i64 {
    match ep.get("failureCount") {
        Some(Bson::Int32(n)) => *n as i64,
        Some(Bson::Int64(n)) => *n,
        Some(Bson::Double(n)) => *n as i64,
        _ => 0,
    }
}

/// Fan `event` (for `payment`) out to every active subscribed endpoint of the
/// merchant. Never panics; designed to be `tokio::spawn`ed fire-and-forget.
pub async fn dispatch(
    mongo: MongoHandle,
    uid: ObjectId,
    event: String,
    payment: PaymentOut,
    mode: String,
) {
    let payment_id = payment.id.clone();

    let ecoll = mongo.collection::<Document>(store::ENDPOINTS);
    let endpoints: Vec<Document> = match ecoll
        .find(doc! { "userId": uid, "active": true, "events": &event })
        .await
    {
        Ok(cursor) => match futures::TryStreamExt::try_collect(cursor).await {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("sabpay webhook endpoints collect: {e}");
                return;
            }
        },
        Err(e) => {
            tracing::error!("sabpay webhook endpoints find: {e}");
            return;
        }
    };
    if endpoints.is_empty() {
        return;
    }

    let envelope = serde_json::json!({
        "id": format!("evt_{}", store::random_hex(12)),
        "event": &event,
        "mode": &mode,
        "timestamp": store::now_iso(),
        "data": { "payment": payment },
    });
    let body = serde_json::to_string(&envelope).unwrap_or_else(|_| "{}".to_owned());

    let dcoll = mongo.collection::<Document>(store::DELIVERIES);

    for ep in endpoints {
        let url = match ep.get_str("url") {
            Ok(u) if !u.is_empty() => u.to_owned(),
            _ => continue,
        };
        let secret = ep.get_str("secret").unwrap_or_default().to_owned();
        let endpoint_oid = ep.get_object_id("_id").ok();
        let before = prev_failures(&ep);

        let signature = sign(&secret, &body);
        let outcome = deliver(&url, &body, &signature, &event).await;
        let now = store::now_iso();

        // Endpoint bookkeeping (+ auto-disable after the failure cap).
        if let Some(eid) = endpoint_oid {
            let update = if outcome.success {
                doc! { "$set": {
                    "failureCount": 0_i64,
                    "lastDeliveryAt": &now,
                    "lastStatus": outcome.status,
                    "lastError": Bson::Null,
                    "updatedAt": &now,
                }}
            } else {
                let next = before + 1;
                let mut set = doc! {
                    "failureCount": next,
                    "lastDeliveryAt": &now,
                    "lastStatus": outcome.status,
                    "lastError": outcome.error.clone(),
                    "updatedAt": &now,
                };
                if next >= store::MAX_CONSECUTIVE_FAILURES {
                    set.insert("active", false);
                }
                doc! { "$set": set }
            };
            if let Err(e) = ecoll.update_one(doc! { "_id": eid }, update).await {
                tracing::error!("sabpay webhook bookkeeping: {e}");
            }
        }

        // Delivery log.
        let mut log = doc! {
            "_id": ObjectId::new(),
            "userId": uid,
            "endpointId": endpoint_oid.unwrap_or_else(ObjectId::new),
            "url": &url,
            "event": &event,
            "paymentId": &payment_id,
            "success": outcome.success,
            "status": outcome.status,
            "attempts": outcome.attempts,
            "createdAt": &now,
        };
        if let Some(err) = &outcome.error {
            log.insert("error", err.clone());
        }
        if let Err(e) = dcoll.insert_one(&log).await {
            tracing::error!("sabpay webhook delivery log: {e}");
        }
    }
}
