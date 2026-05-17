//! Mongo CRUD for `webhook_subscriptions` and `webhook_deliveries`.
//!
//! The Node worker (`services/webhook-worker/`) reads the same
//! collections; do not change field shapes without updating it.

use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::dto::{Delivery, Subscription};

pub const SUBS_COLL: &str = "webhook_subscriptions";
pub const DELIVERIES_COLL: &str = "webhook_deliveries";
/// Plaintext signing secrets, isolated from the public subscription row
/// so a leak of `webhook_subscriptions` doesn't compromise signatures.
/// The Node `webhook-worker` reads from here when assembling each
/// outbound delivery's HMAC.
pub const SECRETS_COLL: &str = "webhook_subscription_secrets";

/// `sab_whsec_<32 url-safe chars>`. The plaintext is returned to the
/// caller on subscription creation and stored as SHA-256 hex.
const SECRET_PREFIX: &str = "sab_whsec_";

fn generate_secret() -> (String, String) {
    const ALPHABET: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let mut suffix = String::with_capacity(32);
    for _ in 0..32 {
        let byte: u8 = rand::random();
        let idx = (byte as usize) % ALPHABET.len();
        suffix.push(ALPHABET[idx] as char);
    }
    let plain = format!("{SECRET_PREFIX}{suffix}");
    let mut h = Sha256::new();
    h.update(suffix.as_bytes());
    let hashed = hex::encode(h.finalize());
    (plain, hashed)
}

#[derive(Debug, Deserialize)]
struct SubRow {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(rename = "tenantId")]
    tenant_id: String,
    url: String,
    #[serde(default)]
    events: Vec<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default, rename = "createdAt")]
    created_at: Option<bson::DateTime>,
    #[serde(default, rename = "lastDeliveryAt")]
    last_delivery_at: Option<bson::DateTime>,
    #[serde(default, rename = "consecutiveFailures")]
    consecutive_failures: Option<i64>,
}

fn sub_row_to_dto(row: SubRow) -> Subscription {
    Subscription {
        id: row.id.to_hex(),
        tenant_id: row.tenant_id,
        url: row.url,
        events: row.events,
        status: row.status.unwrap_or_else(|| "active".to_owned()),
        description: row.description,
        created_at: row
            .created_at
            .map(bson_dt_to_rfc3339)
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
        last_delivery_at: row.last_delivery_at.map(bson_dt_to_rfc3339),
        consecutive_failures: row.consecutive_failures.unwrap_or(0).max(0) as u64,
    }
}

fn bson_dt_to_rfc3339(dt: bson::DateTime) -> String {
    dt.try_to_rfc3339_string()
        .unwrap_or_else(|_| dt.to_chrono().to_rfc3339())
}

pub struct CreatedSub {
    pub subscription: Subscription,
    pub plaintext_secret: String,
}

/// Insert a new subscription. Returns the dto + the plaintext secret —
/// the secret is shown to the developer exactly once.
pub async fn create(
    mongo: &MongoHandle,
    tenant_id: &str,
    url: &str,
    events: Vec<String>,
    description: Option<String>,
) -> Result<CreatedSub> {
    let trimmed = url.trim();
    if trimmed.is_empty() || !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err(ApiError::BadRequest(
            "url must be an absolute http(s) URL.".to_owned(),
        ));
    }

    let (plaintext, hashed) = generate_secret();
    let id = ObjectId::new();
    let now = bson::DateTime::from_chrono(Utc::now());

    let events_bson: Vec<Bson> = events.into_iter().map(Bson::String).collect();

    let doc = doc! {
        "_id": id,
        "tenantId": tenant_id,
        "url": trimmed,
        "events": Bson::Array(events_bson.clone()),
        "status": "active",
        "description": description.clone().unwrap_or_default(),
        "secretHash": &hashed,
        "consecutiveFailures": 0_i64,
        "createdAt": now,
        "lastDeliveryAt": Bson::Null,
    };

    let coll = mongo.collection::<Document>(SUBS_COLL);
    coll.insert_one(doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("webhook_subscriptions.insert_one"))
    })?;

    // Write the plaintext secret to the isolated collection so the
    // dispatcher worker can sign outbound deliveries.
    let secret_doc = doc! {
        "subscriptionId": id,
        "tenantId": tenant_id,
        "secret": &plaintext,
        "createdAt": now,
    };
    mongo
        .collection::<Document>(SECRETS_COLL)
        .insert_one(secret_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("webhook_subscription_secrets.insert_one"),
            )
        })?;

    let row = SubRow {
        id,
        tenant_id: tenant_id.to_owned(),
        url: trimmed.to_owned(),
        events: events_bson
            .into_iter()
            .filter_map(|b| if let Bson::String(s) = b { Some(s) } else { None })
            .collect(),
        status: Some("active".to_owned()),
        description,
        created_at: Some(now),
        last_delivery_at: None,
        consecutive_failures: Some(0),
    };

    Ok(CreatedSub {
        subscription: sub_row_to_dto(row),
        plaintext_secret: plaintext,
    })
}

pub async fn list(mongo: &MongoHandle, tenant_id: &str) -> Result<Vec<Subscription>> {
    let coll = mongo.collection::<SubRow>(SUBS_COLL);
    let cursor = coll
        .find(doc! { "tenantId": tenant_id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("webhook_subscriptions.find"))
        })?;
    let rows: Vec<SubRow> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("webhook_subscriptions.collect"))
    })?;
    Ok(rows.into_iter().map(sub_row_to_dto).collect())
}

pub async fn get_one(
    mongo: &MongoHandle,
    tenant_id: &str,
    sub_id: &str,
) -> Result<Option<Subscription>> {
    let oid = ObjectId::parse_str(sub_id)
        .map_err(|_| ApiError::BadRequest("Invalid subscription id.".to_owned()))?;
    let coll = mongo.collection::<SubRow>(SUBS_COLL);
    let row = coll
        .find_one(doc! { "_id": oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("webhook_subscriptions.find_one"))
        })?;
    Ok(row.map(sub_row_to_dto))
}

pub async fn update(
    mongo: &MongoHandle,
    tenant_id: &str,
    sub_id: &str,
    url: Option<String>,
    events: Option<Vec<String>>,
    description: Option<String>,
    status: Option<String>,
) -> Result<bool> {
    let oid = ObjectId::parse_str(sub_id)
        .map_err(|_| ApiError::BadRequest("Invalid subscription id.".to_owned()))?;
    let mut set = doc! {};
    if let Some(u) = url {
        let trimmed = u.trim();
        if trimmed.is_empty()
            || !(trimmed.starts_with("http://") || trimmed.starts_with("https://"))
        {
            return Err(ApiError::BadRequest(
                "url must be an absolute http(s) URL.".to_owned(),
            ));
        }
        set.insert("url", trimmed);
    }
    if let Some(e) = events {
        let bson_events: Vec<Bson> = e.into_iter().map(Bson::String).collect();
        set.insert("events", Bson::Array(bson_events));
    }
    if let Some(d) = description {
        set.insert("description", d);
    }
    if let Some(s) = status {
        if !["active", "paused", "failed"].contains(&s.as_str()) {
            return Err(ApiError::BadRequest(
                "status must be one of active|paused|failed.".to_owned(),
            ));
        }
        set.insert("status", s);
    }
    if set.is_empty() {
        return Ok(true);
    }

    let coll = mongo.collection::<Document>(SUBS_COLL);
    let res = coll
        .update_one(
            doc! { "_id": oid, "tenantId": tenant_id },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("webhook_subscriptions.update_one"))
        })?;
    Ok(res.matched_count > 0)
}

pub async fn delete(mongo: &MongoHandle, tenant_id: &str, sub_id: &str) -> Result<bool> {
    let oid = ObjectId::parse_str(sub_id)
        .map_err(|_| ApiError::BadRequest("Invalid subscription id.".to_owned()))?;
    let coll = mongo.collection::<Document>(SUBS_COLL);
    let res = coll
        .delete_one(doc! { "_id": oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("webhook_subscriptions.delete_one"))
        })?;
    // Cascade: drop the secret + any pending deliveries.
    let _ = mongo
        .collection::<Document>(SECRETS_COLL)
        .delete_one(doc! { "subscriptionId": oid })
        .await;
    let _ = mongo
        .collection::<Document>(DELIVERIES_COLL)
        .delete_many(doc! { "subscriptionId": oid, "status": "pending" })
        .await;
    Ok(res.deleted_count > 0)
}

/// Enqueue a synthetic test delivery. Implemented as an insert into
/// `webhook_deliveries` with `event: 'developer.webhook.test'`. The Node
/// worker picks it up off the next queue scan.
pub async fn enqueue_test(
    mongo: &MongoHandle,
    tenant_id: &str,
    sub_id: &str,
) -> Result<bool> {
    let oid = ObjectId::parse_str(sub_id)
        .map_err(|_| ApiError::BadRequest("Invalid subscription id.".to_owned()))?;
    let coll_subs = mongo.collection::<Document>(SUBS_COLL);
    let exists = coll_subs
        .find_one(doc! { "_id": oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("webhook_subscriptions.find_one"))
        })?;
    if exists.is_none() {
        return Ok(false);
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let delivery = doc! {
        "_id": ObjectId::new(),
        "subscriptionId": oid,
        "tenantId": tenant_id,
        "event": "developer.webhook.test",
        "payload": doc! { "test": true },
        "status": "pending",
        "attempts": 0_i64,
        "createdAt": now,
        "nextAttemptAt": now,
    };
    let coll = mongo.collection::<Document>(DELIVERIES_COLL);
    coll.insert_one(delivery).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("webhook_deliveries.insert_one"))
    })?;
    Ok(true)
}

/* ── Deliveries listing ─────────────────────────────────────────────────── */

#[derive(Debug, Deserialize)]
struct DeliveryRow {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(rename = "subscriptionId")]
    subscription_id: ObjectId,
    event: String,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    attempts: Option<i64>,
    #[serde(default, rename = "responseStatus")]
    response_status: Option<i32>,
    #[serde(default, rename = "lastError")]
    last_error: Option<String>,
    #[serde(default, rename = "createdAt")]
    created_at: Option<bson::DateTime>,
    #[serde(default, rename = "finishedAt")]
    finished_at: Option<bson::DateTime>,
    #[serde(default, rename = "nextAttemptAt")]
    next_attempt_at: Option<bson::DateTime>,
}

pub async fn list_deliveries(
    mongo: &MongoHandle,
    tenant_id: &str,
    sub_id: Option<&str>,
    limit: i64,
) -> Result<Vec<Delivery>> {
    let mut filter = doc! { "tenantId": tenant_id };
    if let Some(s) = sub_id {
        if let Ok(oid) = ObjectId::parse_str(s) {
            filter.insert("subscriptionId", oid);
        }
    }
    let coll = mongo.collection::<DeliveryRow>(DELIVERIES_COLL);
    let cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(limit.clamp(1, 200))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("webhook_deliveries.find"))
        })?;
    let rows: Vec<DeliveryRow> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("webhook_deliveries.collect"))
    })?;
    Ok(rows
        .into_iter()
        .map(|r| Delivery {
            id: r.id.to_hex(),
            subscription_id: r.subscription_id.to_hex(),
            event: r.event,
            status: r.status.unwrap_or_else(|| "pending".to_owned()),
            attempts: r.attempts.unwrap_or(0).max(0) as u64,
            response_status: r.response_status,
            last_error: r.last_error,
            created_at: r
                .created_at
                .map(bson_dt_to_rfc3339)
                .unwrap_or_else(|| Utc::now().to_rfc3339()),
            finished_at: r.finished_at.map(bson_dt_to_rfc3339),
            next_attempt_at: r.next_attempt_at.map(bson_dt_to_rfc3339),
        })
        .collect())
}

/// Reset a failed delivery for another attempt. Returns true if reset.
pub async fn retry_delivery(
    mongo: &MongoHandle,
    tenant_id: &str,
    delivery_id: &str,
) -> Result<bool> {
    let oid = ObjectId::parse_str(delivery_id)
        .map_err(|_| ApiError::BadRequest("Invalid delivery id.".to_owned()))?;
    let coll = mongo.collection::<Document>(DELIVERIES_COLL);
    let res = coll
        .update_one(
            doc! {
                "_id": oid,
                "tenantId": tenant_id,
                "status": "failed",
            },
            doc! {
                "$set": {
                    "status": "pending",
                    "nextAttemptAt": bson::DateTime::from_chrono(Utc::now()),
                },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("webhook_deliveries.update_one"))
        })?;
    Ok(res.matched_count > 0)
}
