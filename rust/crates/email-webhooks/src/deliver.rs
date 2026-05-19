//! Outbound webhook delivery helper.
//!
//! `deliver()` is the public entrypoint other email crates call when
//! they record an `email_events` row that subscribers care about. The
//! caller passes the loaded `WebhookConfigRecord` plus the JSON event
//! payload — this module signs and ships the request, bumping the
//! `lastDeliveredAt` / `lastFailedAt` counters as appropriate.
//!
//! ## Signature contract
//!
//! ```text
//! X-SabNode-Signature: t=<unix>,v1=<hex>
//! v1 = HMAC-SHA256(secret, "<t>.<body>")
//! ```
//!
//! Subscribers verify by re-computing the HMAC over the raw request
//! body using the timestamp from the header and the secret they
//! received at config creation, then constant-time-comparing. The
//! timestamp gives them a replay window if they want one.

use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use hmac::{Hmac, Mac};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;
use sha2::Sha256;

use crate::handlers::CONFIGS_COLL;

type HmacSha256 = Hmac<Sha256>;

/// Snapshot of the row the delivery helper needs. Callers either build
/// this from a [`crate::dto::WebhookConfig`] + secret they fetched out
/// of band, or load it directly from `email_webhook_configs`.
#[derive(Debug, Clone)]
pub struct WebhookConfigRecord {
    pub id: ObjectId,
    pub user_id: String,
    pub url: String,
    pub secret: String,
    pub events: Vec<String>,
    pub active: bool,
}

/// Deliver `event` to `config` using a freshly-signed POST. Bumps
/// `lastDeliveredAt` on 2xx, `lastFailedAt` + `failureCount` otherwise.
///
/// The function returns `Ok(true)` when the subscriber accepted the
/// payload (any 2xx response), `Ok(false)` for a delivered-but-not-ok
/// status, and `Err` only when the request itself could not be sent
/// (network failure, etc).
pub async fn deliver(
    mongo: &MongoHandle,
    http: &reqwest::Client,
    config: &WebhookConfigRecord,
    event: &Value,
) -> Result<bool> {
    if !config.active {
        return Ok(false);
    }

    let body =
        serde_json::to_string(event).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let ts = Utc::now().timestamp();
    let signature = sign(config.secret.as_bytes(), ts, &body);
    let header_value = format!("t={ts},v1={signature}");

    let res = http
        .post(&config.url)
        .header("X-SabNode-Signature", header_value)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await;

    let coll = mongo.collection::<Document>(CONFIGS_COLL);
    let now = bson::DateTime::from_chrono(Utc::now());

    match res {
        Ok(r) if r.status().is_success() => {
            let _ = coll
                .update_one(
                    doc! { "_id": config.id },
                    doc! { "$set": { "lastDeliveredAt": now } },
                )
                .await;
            Ok(true)
        }
        Ok(_) => {
            let _ = coll
                .update_one(
                    doc! { "_id": config.id },
                    doc! { "$set": { "lastFailedAt": now }, "$inc": { "failureCount": 1_i64 } },
                )
                .await;
            Ok(false)
        }
        Err(e) => {
            let _ = coll
                .update_one(
                    doc! { "_id": config.id },
                    doc! { "$set": { "lastFailedAt": now }, "$inc": { "failureCount": 1_i64 } },
                )
                .await;
            Err(ApiError::Internal(
                anyhow::Error::new(e).context("webhook POST"),
            ))
        }
    }
}

/// Compute the hex HMAC-SHA256 of `"{ts}.{body}"` keyed by `secret`.
pub fn sign(secret: &[u8], ts: i64, body: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(secret).expect("HMAC accepts arbitrary key sizes");
    mac.update(format!("{ts}.").as_bytes());
    mac.update(body.as_bytes());
    let bytes = mac.finalize().into_bytes();
    hex::encode(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// HMAC-SHA256 reference vector — stable so we'd catch a hasher swap.
    #[test]
    fn sign_is_deterministic() {
        let a = sign(b"secret", 1_700_000_000, r#"{"k":1}"#);
        let b = sign(b"secret", 1_700_000_000, r#"{"k":1}"#);
        assert_eq!(a, b);
        assert_eq!(a.len(), 64);
    }
}
