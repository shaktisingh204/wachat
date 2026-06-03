//! Axum handlers for `/v1/email/webhooks`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde_json::json;
use tracing::instrument;

use crate::deliver::{WebhookConfigRecord, deliver, sign};
use crate::dto::{
    CreateBody, ListResponse, MessageResponse, TestResponse, UpdateBody, UpdateResponse,
    WebhookConfig, WebhookConfigWithSecret,
};
use crate::state::EmailWebhooksState;

pub const CONFIGS_COLL: &str = "email_webhook_configs";

fn now_bson() -> bson::DateTime {
    bson::DateTime::from_chrono(Utc::now())
}

fn dt_to_rfc3339(dt: bson::DateTime) -> String {
    dt.try_to_rfc3339_string()
        .unwrap_or_else(|_| dt.to_chrono().to_rfc3339())
}

fn generate_secret() -> String {
    // 32-byte secret, hex-encoded. The webhook signing path keys an
    // HMAC with this, so any high-entropy value works — hex keeps the
    // dashboard render and the env-var copy/paste flow simple.
    let mut buf = [0u8; 32];
    for b in buf.iter_mut() {
        *b = rand::random();
    }
    hex::encode(buf)
}

fn doc_to_config(d: &Document) -> WebhookConfig {
    let id = d
        .get_object_id("_id")
        .map(|o| o.to_hex())
        .unwrap_or_default();
    let events = d
        .get_array("events")
        .ok()
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_str().map(|s| s.to_owned()))
                .collect()
        })
        .unwrap_or_default();

    WebhookConfig {
        id,
        url: d.get_str("url").unwrap_or_default().to_owned(),
        events,
        active: d.get_bool("active").unwrap_or(true),
        failure_count: d.get_i64("failureCount").ok().map(|v| v.max(0) as u64),
        last_delivered_at: d
            .get_datetime("lastDeliveredAt")
            .ok()
            .map(|dt| dt_to_rfc3339(*dt)),
        last_failed_at: d
            .get_datetime("lastFailedAt")
            .ok()
            .map(|dt| dt_to_rfc3339(*dt)),
        created_at: d
            .get_datetime("createdAt")
            .ok()
            .map(|dt| dt_to_rfc3339(*dt))
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
        updated_at: d
            .get_datetime("updatedAt")
            .ok()
            .map(|dt| dt_to_rfc3339(*dt))
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
    }
}

// ===========================================================================
// Handlers
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_configs(
    user: AuthUser,
    State(state): State<EmailWebhooksState>,
) -> Result<Json<ListResponse>> {
    let coll = state.mongo.collection::<Document>(CONFIGS_COLL);
    let cursor = coll
        .find(doc! { "userId": &user.tenant_id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("email_webhook_configs.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("email_webhook_configs.collect"))
    })?;
    let configs = docs.iter().map(doc_to_config).collect();
    Ok(Json(ListResponse { configs }))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn create_config(
    user: AuthUser,
    State(state): State<EmailWebhooksState>,
    Json(body): Json<CreateBody>,
) -> Result<Json<WebhookConfigWithSecret>> {
    let url = body.url.trim();
    if url.is_empty() {
        return Err(ApiError::BadRequest("url is required".to_owned()));
    }
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err(ApiError::BadRequest(
            "url must be an http(s) URL".to_owned(),
        ));
    }

    let id = ObjectId::new();
    let secret = generate_secret();
    let now = now_bson();
    let events_bson: Vec<Bson> = body.events.iter().cloned().map(Bson::String).collect();

    let doc = doc! {
        "_id": id,
        "userId": &user.tenant_id,
        "url": url,
        "secret": &secret,
        "events": Bson::Array(events_bson),
        "active": body.active,
        "failureCount": 0_i64,
        "createdAt": now,
        "updatedAt": now,
    };

    let coll = state.mongo.collection::<Document>(CONFIGS_COLL);
    coll.insert_one(doc.clone()).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("email_webhook_configs.insert_one"))
    })?;

    Ok(Json(WebhookConfigWithSecret {
        config: doc_to_config(&doc),
        secret,
    }))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn update_config(
    user: AuthUser,
    State(state): State<EmailWebhooksState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateBody>,
) -> Result<Json<UpdateResponse>> {
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::BadRequest("invalid webhook id".to_owned()))?;

    let mut set = Document::new();
    if let Some(url) = body.url.as_deref() {
        let trimmed = url.trim();
        if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
            return Err(ApiError::BadRequest(
                "url must be an http(s) URL".to_owned(),
            ));
        }
        set.insert("url", trimmed);
    }
    if let Some(events) = &body.events {
        let events_bson: Vec<Bson> = events.iter().cloned().map(Bson::String).collect();
        set.insert("events", Bson::Array(events_bson));
    }
    if let Some(active) = body.active {
        set.insert("active", active);
    }
    let new_secret = if body.regenerate_secret {
        let s = generate_secret();
        set.insert("secret", &s);
        Some(s)
    } else {
        None
    };
    if set.is_empty() {
        return Err(ApiError::BadRequest("no fields to update".to_owned()));
    }
    set.insert("updatedAt", now_bson());

    let coll = state.mongo.collection::<Document>(CONFIGS_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "_id": oid, "userId": &user.tenant_id },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("email_webhook_configs.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound(format!("webhook {id}")))?;

    Ok(Json(UpdateResponse {
        config: doc_to_config(&updated),
        secret: new_secret,
    }))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn delete_config(
    user: AuthUser,
    State(state): State<EmailWebhooksState>,
    Path(id): Path<String>,
) -> Result<Json<MessageResponse>> {
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::BadRequest("invalid webhook id".to_owned()))?;
    let coll = state.mongo.collection::<Document>(CONFIGS_COLL);
    let res = coll
        .delete_one(doc! { "_id": oid, "userId": &user.tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("email_webhook_configs.delete_one"))
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound(format!("webhook {id}")));
    }
    Ok(Json(MessageResponse {
        message: "webhook deleted".to_owned(),
    }))
}

/// `POST /{id}/test` — fire a synthetic test payload. The body is the
/// fixed shape `{ "test": true, "ts": <unix> }` so subscribers can
/// branch on `test === true` and avoid persisting the payload.
#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn test_config(
    user: AuthUser,
    State(state): State<EmailWebhooksState>,
    Path(id): Path<String>,
) -> Result<Json<TestResponse>> {
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::BadRequest("invalid webhook id".to_owned()))?;

    let coll = state.mongo.collection::<Document>(CONFIGS_COLL);
    let d = coll
        .find_one(doc! { "_id": oid, "userId": &user.tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("email_webhook_configs.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound(format!("webhook {id}")))?;

    let record = WebhookConfigRecord {
        id: oid,
        user_id: user.tenant_id.clone(),
        url: d.get_str("url").unwrap_or_default().to_owned(),
        secret: d.get_str("secret").unwrap_or_default().to_owned(),
        events: d
            .get_array("events")
            .ok()
            .map(|arr| {
                arr.iter()
                    .filter_map(|b| b.as_str().map(|s| s.to_owned()))
                    .collect()
            })
            .unwrap_or_default(),
        active: d.get_bool("active").unwrap_or(true),
    };

    let payload = json!({
        "test": true,
        "ts": Utc::now().timestamp(),
    });

    let delivered = deliver(&state.mongo, &state.http, &record, &payload).await?;
    Ok(Json(TestResponse {
        delivered,
        status: None,
    }))
}

// Re-export for downstream consumers (deliver.rs uses CONFIGS_COLL).
// Silence unused warning when `sign` is only used in tests.
#[allow(dead_code)]
fn _re_exports(secret: &[u8], ts: i64, body: &str) -> String {
    sign(secret, ts, body)
}
