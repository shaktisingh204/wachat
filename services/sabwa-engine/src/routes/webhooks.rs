//! `/v1/webhooks` — CRUD + test-fire + delivery history for outbound
//! webhook subscriptions.
//!
//! Mirrors the management surface described in `SABWA_PLAN.md` §12. The
//! actual outbound delivery loop lives in
//! [`crate::webhooks::dispatcher`]; this module only owns the
//! `sabwa_webhooks` persistence + a one-shot test fire used by the UI to
//! validate that a receiver is reachable.
//!
//! ### Secret-handling note
//!
//! The HMAC signing secret is generated on the server, persisted **in
//! plaintext** alongside the webhook row (the dispatcher needs the raw
//! bytes to compute `HMAC-SHA256(secret, "{ts}.{body}")` on every fire),
//! and returned to the caller exactly **once** in the create response.
//! This mirrors industry-standard webhook secret handling (Stripe, GitHub,
//! …) and is *not* the same model as API-token storage where only a hash
//! is kept.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use bson::{doc, oid::ObjectId, Bson, DateTime as BsonDateTime};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use rand::RngCore;
use serde::{Deserialize, Serialize};

use crate::audit::{self, AuditEntry};
use crate::error::AppError;
use crate::state::AppState;
use crate::webhooks::delivery::{self, deliver, DeliveryAttempt};

/// `sabwa_webhooks` Mongo collection name.
const WEBHOOKS_COLLECTION: &str = "sabwa_webhooks";

/// Build the `/webhooks` sub-router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_webhooks).post(create_webhook))
        .route(
            "/:id",
            axum::routing::patch(update_webhook).delete(delete_webhook),
        )
        .route("/:id/test", post(test_webhook))
        .route("/:id/deliveries", get(list_deliveries))
}

// ─── DTOs ───────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListWebhooksQuery {
    pub project_id: String,
    #[serde(default)]
    pub session_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookDto {
    pub id: String,
    pub project_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub url: String,
    pub events: Vec<String>,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListWebhooksResponse {
    pub items: Vec<WebhookDto>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWebhookRequest {
    pub project_id: String,
    #[serde(default)]
    pub session_id: Option<String>,
    pub url: String,
    pub events: Vec<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWebhookResponse {
    #[serde(flatten)]
    pub webhook: WebhookDto,
    /// Raw 64-char hex signing secret. Shown **once**, never returned again.
    pub signing_secret: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWebhookRequest {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub events: Option<Vec<String>>,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteWebhookResponse {
    pub id: String,
    pub deleted: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestWebhookResponse {
    pub event_id: String,
    pub status_code: u16,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDeliveriesQuery {
    #[serde(default = "default_limit")]
    pub limit: u32,
}

fn default_limit() -> u32 {
    50
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDeliveriesResponse {
    pub items: Vec<DeliveryAttempt>,
}

// ─── Handlers ───────────────────────────────────────────────────────────

async fn list_webhooks(
    State(state): State<AppState>,
    Query(q): Query<ListWebhooksQuery>,
) -> Result<Json<ListWebhooksResponse>, AppError> {
    let project_oid = parse_oid(&q.project_id, "projectId")?;
    let mut filter = doc! { "projectId": project_oid };
    if let Some(sid) = q.session_id.as_deref() {
        let session_oid = parse_oid(sid, "sessionId")?;
        filter.insert("sessionId", session_oid);
    }

    let col = state
        .db
        .collection::<bson::Document>(WEBHOOKS_COLLECTION);
    let cursor = col
        .find(filter)
        .await
        .map_err(|e| AppError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<bson::Document> = cursor
        .try_collect()
        .await
        .map_err(|e| AppError::Internal(anyhow::Error::new(e)))?;

    let items = docs.into_iter().filter_map(doc_to_dto).collect();
    Ok(Json(ListWebhooksResponse { items }))
}

async fn create_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateWebhookRequest>,
) -> Result<(StatusCode, Json<CreateWebhookResponse>), AppError> {
    let (actor_ip, user_agent) = audit::extract_context(&headers);
    if body.url.trim().is_empty() {
        return Err(AppError::BadRequest("url must not be empty".into()));
    }
    if body.events.is_empty() {
        return Err(AppError::BadRequest("events must not be empty".into()));
    }

    let project_oid = parse_oid(&body.project_id, "projectId")?;
    let session_oid = match body.session_id.as_deref() {
        Some(sid) => Some(parse_oid(sid, "sessionId")?),
        None => None,
    };

    let secret = generate_signing_secret();
    let now = Utc::now();
    let new_id = ObjectId::new();

    let mut doc = doc! {
        "_id": new_id,
        "projectId": project_oid,
        "url": body.url.trim(),
        "events": body
            .events
            .iter()
            .map(|e| Bson::String(e.clone()))
            .collect::<Vec<_>>(),
        "signingSecret": &secret,
        "enabled": true,
        "failureCount": 0i32,
        "createdAt": Bson::DateTime(BsonDateTime::from_chrono(now)),
        "updatedAt": Bson::DateTime(BsonDateTime::from_chrono(now)),
    };
    if let Some(sid) = session_oid {
        doc.insert("sessionId", sid);
    }
    if let Some(desc) = body.description.as_deref() {
        doc.insert("description", desc);
    }

    let col = state
        .db
        .collection::<bson::Document>(WEBHOOKS_COLLECTION);
    col.insert_one(&doc)
        .await
        .map_err(|e| AppError::Internal(anyhow::Error::new(e)))?;

    tracing::info!(
        target: "sabwa::webhooks::routes",
        webhook_id = %new_id,
        project_id = %body.project_id,
        url = %body.url,
        events = ?body.events,
        "webhook created"
    );

    let dto = WebhookDto {
        id: new_id.to_hex(),
        project_id: body.project_id.clone(),
        session_id: body.session_id.clone(),
        url: body.url.clone(),
        events: body.events.clone(),
        enabled: true,
        description: body.description.clone(),
        created_at: now,
        updated_at: Some(now),
    };

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: body.project_id,
            user_id: None,
            session_id: body.session_id,
            action: "webhook.create".into(),
            target_kind: Some("webhook".into()),
            target_id: Some(new_id.to_hex()),
            metadata: serde_json::json!({
                "url": body.url,
                "events": body.events,
            }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok((
        StatusCode::CREATED,
        Json(CreateWebhookResponse {
            webhook: dto,
            signing_secret: secret,
        }),
    ))
}

async fn update_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateWebhookRequest>,
) -> Result<Json<WebhookDto>, AppError> {
    let (actor_ip, user_agent) = audit::extract_context(&headers);
    let oid = parse_oid(&id, "id")?;
    let mut set = bson::Document::new();
    if let Some(url) = body.url {
        if url.trim().is_empty() {
            return Err(AppError::BadRequest("url must not be empty".into()));
        }
        set.insert("url", url.trim());
    }
    if let Some(events) = body.events {
        if events.is_empty() {
            return Err(AppError::BadRequest("events must not be empty".into()));
        }
        let arr: Vec<Bson> = events.into_iter().map(Bson::String).collect();
        set.insert("events", arr);
    }
    if let Some(enabled) = body.enabled {
        set.insert("enabled", enabled);
    }
    if let Some(desc) = body.description {
        set.insert("description", desc);
    }
    if set.is_empty() {
        return Err(AppError::BadRequest("no updatable fields supplied".into()));
    }
    set.insert("updatedAt", Bson::DateTime(BsonDateTime::now()));

    let col = state
        .db
        .collection::<bson::Document>(WEBHOOKS_COLLECTION);
    let res = col
        .update_one(doc! { "_id": &oid }, doc! { "$set": set })
        .await
        .map_err(|e| AppError::Internal(anyhow::Error::new(e)))?;
    if res.matched_count == 0 {
        return Err(AppError::NotFound);
    }

    let updated = col
        .find_one(doc! { "_id": &oid })
        .await
        .map_err(|e| AppError::Internal(anyhow::Error::new(e)))?
        .ok_or(AppError::NotFound)?;
    let dto = doc_to_dto(updated).ok_or_else(|| {
        AppError::Internal(anyhow::anyhow!("failed to decode updated webhook row"))
    })?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: dto.project_id.clone(),
            user_id: None,
            session_id: dto.session_id.clone(),
            action: "webhook.update".into(),
            target_kind: Some("webhook".into()),
            target_id: Some(dto.id.clone()),
            metadata: serde_json::json!({
                "url": dto.url,
                "events": dto.events,
                "enabled": dto.enabled,
            }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(dto))
}

async fn delete_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<DeleteWebhookResponse>, AppError> {
    let (actor_ip, user_agent) = audit::extract_context(&headers);
    let oid = parse_oid(&id, "id")?;
    let col = state
        .db
        .collection::<bson::Document>(WEBHOOKS_COLLECTION);
    let res = col
        .delete_one(doc! { "_id": &oid })
        .await
        .map_err(|e| AppError::Internal(anyhow::Error::new(e)))?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: None,
            action: "webhook.delete".into(),
            target_kind: Some("webhook".into()),
            target_id: Some(id.clone()),
            metadata: serde_json::json!({}),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(DeleteWebhookResponse {
        id,
        deleted: res.deleted_count > 0,
    }))
}

async fn test_webhook(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<TestWebhookResponse>, AppError> {
    let oid = parse_oid(&id, "id")?;
    let col = state
        .db
        .collection::<bson::Document>(WEBHOOKS_COLLECTION);
    let hook = col
        .find_one(doc! { "_id": &oid })
        .await
        .map_err(|e| AppError::Internal(anyhow::Error::new(e)))?
        .ok_or(AppError::NotFound)?;

    let url = hook
        .get_str("url")
        .map_err(|_| AppError::Internal(anyhow::anyhow!("webhook row missing url")))?
        .to_owned();
    let secret = hook
        .get_str("signingSecret")
        .map_err(|_| AppError::Internal(anyhow::anyhow!("webhook row missing signingSecret")))?
        .to_owned();

    // Build a synthetic `webhook.test` payload. Includes the webhook id so
    // a receiver can correlate it on its end.
    let event_id = uuid::Uuid::new_v4().to_string();
    let body = serde_json::json!({
        "kind": "webhook.test",
        "webhookId": id,
        "ts": Utc::now().timestamp(),
        "message": "This is a test event from SabWa.",
    });

    let http = reqwest::Client::builder()
        .timeout(delivery::REQUEST_TIMEOUT)
        .user_agent(concat!("sabwa-engine/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| AppError::Internal(anyhow::Error::new(e)))?;

    let mut record = DeliveryAttempt::new(id.clone(), event_id.clone(), url.clone(), 1);
    let outcome = deliver(&http, &url, &secret, &event_id, &body).await;
    let (status_code, success, error) = match outcome {
        Ok(code) => {
            record.status_code = code;
            ((code), (200..300).contains(&code), None)
        }
        Err(err) => {
            let msg = format!("{err:#}");
            record.error = Some(msg.clone());
            (0_u16, false, Some(msg))
        }
    };

    if let Err(err) = DeliveryAttempt::persist(&state.db, &record).await {
        tracing::warn!(
            target: "sabwa::webhooks::routes",
            error = %err,
            "persisting test DeliveryAttempt failed"
        );
    }

    Ok(Json(TestWebhookResponse {
        event_id,
        status_code,
        success,
        error,
    }))
}

async fn list_deliveries(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(q): Query<ListDeliveriesQuery>,
) -> Result<Json<ListDeliveriesResponse>, AppError> {
    // Validate the path id is a well-formed ObjectId, but the delivery row
    // stores `webhookId` as a hex *string* (see `DeliveryAttempt`) so we
    // filter on the hex form.
    let _ = parse_oid(&id, "id")?;

    let limit = q.limit.clamp(1, 500) as i64;
    let col = state
        .db
        .collection::<DeliveryAttempt>(delivery::COLLECTION);
    let cursor = col
        .find(doc! { "webhook_id": &id })
        .sort(doc! { "sent_at": -1 })
        .limit(limit)
        .await
        .map_err(|e| AppError::Internal(anyhow::Error::new(e)))?;
    let items: Vec<DeliveryAttempt> = cursor
        .try_collect()
        .await
        .map_err(|e| AppError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(ListDeliveriesResponse { items }))
}

// ─── Helpers ────────────────────────────────────────────────────────────

fn parse_oid(raw: &str, field: &'static str) -> Result<ObjectId, AppError> {
    ObjectId::parse_str(raw)
        .map_err(|_| AppError::BadRequest(format!("{field} is not a valid ObjectId")))
}

/// Generate a 32-byte random secret encoded as 64 lower-case hex chars.
///
/// `OsRng` reads from the OS CSPRNG (`/dev/urandom` on Linux, BCrypt on
/// Windows) — i.e. cryptographically suitable for HMAC keys.
fn generate_signing_secret() -> String {
    let mut buf = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut buf);
    hex_encode(&buf)
}

fn hex_encode(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(ALPHABET[(b >> 4) as usize] as char);
        out.push(ALPHABET[(b & 0x0f) as usize] as char);
    }
    out
}

fn doc_to_dto(d: bson::Document) -> Option<WebhookDto> {
    let id = d.get_object_id("_id").ok()?.to_hex();
    let project_id = match d.get("projectId") {
        Some(Bson::ObjectId(o)) => o.to_hex(),
        Some(Bson::String(s)) => s.clone(),
        _ => return None,
    };
    let session_id = match d.get("sessionId") {
        Some(Bson::ObjectId(o)) => Some(o.to_hex()),
        Some(Bson::String(s)) => Some(s.clone()),
        _ => None,
    };
    let url = d.get_str("url").ok()?.to_owned();
    let events = match d.get("events") {
        Some(Bson::Array(arr)) => arr
            .iter()
            .filter_map(|v| v.as_str().map(str::to_owned))
            .collect(),
        _ => Vec::new(),
    };
    let enabled = d.get_bool("enabled").unwrap_or(true);
    let description = d.get_str("description").ok().map(str::to_owned);
    let created_at = match d.get("createdAt") {
        Some(Bson::DateTime(dt)) => dt.to_chrono(),
        _ => Utc::now(),
    };
    let updated_at = match d.get("updatedAt") {
        Some(Bson::DateTime(dt)) => Some(dt.to_chrono()),
        _ => None,
    };
    Some(WebhookDto {
        id,
        project_id,
        session_id,
        url,
        events,
        enabled,
        description,
        created_at,
        updated_at,
    })
}
