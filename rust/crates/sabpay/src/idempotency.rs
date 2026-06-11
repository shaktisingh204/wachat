//! `Idempotency-Key` support for mutating public-API endpoints.
//!
//! The Next.js public routes forward the client's `Idempotency-Key` header
//! verbatim. The first request with a given key runs the handler and stores its
//! response; replays of the same key return the stored response without
//! re-running the side effect. A different request body under the same key is a
//! `409 idempotency_key_reused`.
//!
//! Convention break (deliberate): `expiresAt` is a real BSON `DateTime` so a
//! Mongo TTL index (`{expiresAt:1}` expireAfterSeconds 0) can sweep keys after
//! 24h. Every other timestamp in SabPay is an ISO string — never read this one
//! with `store::iso_opt`.

use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

use crate::store::{self, num_opt_i64, sha256_hex, str_or};

const TTL_HOURS: i64 = 24;

/// Outcome of an idempotency check.
pub enum IdemOutcome {
    /// No key supplied — run the handler normally.
    NoKey,
    /// A completed prior response exists — return it verbatim.
    Replay { status: i32, body: String },
    /// First-seen key (a pending row was claimed) — run the handler, then call
    /// [`store_response`] with the same key.
    Proceed { key: String },
}

/// SHA-256 of the raw request body, used to detect key reuse with a different
/// payload.
pub fn body_hash(raw: &str) -> String {
    sha256_hex(raw)
}

/// Resolve an idempotency key. Inserts a pending row (race-safe; relies on the
/// unique index `{userId,key,method,path}`) when first-seen.
pub async fn check(
    mongo: &MongoHandle,
    uid: ObjectId,
    mode: &str,
    key: Option<&str>,
    method: &str,
    path: &str,
    request_hash: &str,
) -> Result<IdemOutcome> {
    let key = match key.map(str::trim).filter(|s| !s.is_empty()) {
        Some(k) => k.chars().take(255).collect::<String>(),
        None => return Ok(IdemOutcome::NoKey),
    };
    let coll = mongo.collection::<Document>(store::IDEMPOTENCY);
    let filter = doc! { "userId": uid, "key": &key, "method": method, "path": path };

    if let Some(existing) = coll
        .find_one(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.idem.find")))?
    {
        let stored_hash = str_or(&existing, "requestHash", "");
        if stored_hash != request_hash {
            return Err(ApiError::Conflict(
                "idempotency_key_reused: the same Idempotency-Key was used with a different request."
                    .to_owned(),
            ));
        }
        let status = num_opt_i64(&existing, "status").unwrap_or(0) as i32;
        let body = str_or(&existing, "responseBody", "");
        if status == 0 || body.is_empty() {
            // A concurrent first request is still in flight.
            return Err(ApiError::Conflict(
                "A request with this Idempotency-Key is still being processed.".to_owned(),
            ));
        }
        return Ok(IdemOutcome::Replay { status, body });
    }

    let expires = BsonDateTime::from_chrono(Utc::now() + Duration::hours(TTL_HOURS));
    let pending = doc! {
        "_id": ObjectId::new(),
        "userId": uid,
        "mode": mode,
        "key": &key,
        "method": method,
        "path": path,
        "requestHash": request_hash,
        "status": 0_i32,
        "responseBody": "",
        "createdAt": store::now_iso(),
        "expiresAt": expires,
    };
    match coll.insert_one(&pending).await {
        Ok(_) => Ok(IdemOutcome::Proceed { key }),
        // Lost the race to a concurrent insert — treat as in-flight.
        Err(_) => Err(ApiError::Conflict(
            "A request with this Idempotency-Key is still being processed.".to_owned(),
        )),
    }
}

/// Persist the handler's response so future replays return it.
pub async fn store_response(
    mongo: &MongoHandle,
    uid: ObjectId,
    key: &str,
    method: &str,
    path: &str,
    status: i32,
    body: &str,
) {
    let coll = mongo.collection::<Document>(store::IDEMPOTENCY);
    let _ = coll
        .update_one(
            doc! { "userId": uid, "key": key, "method": method, "path": path },
            doc! { "$set": {
                "status": status,
                "responseBody": body.chars().take(64_000).collect::<String>(),
            }},
        )
        .await;
}
