use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{Duration, Utc};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    mock_db::MockDb,
    models::{
        ApiKey, ApiKeyGeneratePayload, ApiKeyGenerateResponse, DeliveryStatus, EventDelivery,
        OauthApp, OauthAppCreatePayload, OauthAppUpdatePayload, PaginatedResponse, Webhook,
        WebhookCreatePayload, WebhookUpdatePayload,
    },
};

// Webhook Handlers
pub async fn create_webhook(
    State(db): State<MockDb>,
    Json(payload): Json<WebhookCreatePayload>,
) -> (StatusCode, Json<Webhook>) {
    let mut webhooks = db.webhooks.write().await;
    let webhook = Webhook {
        id: Uuid::new_v4(),
        name: payload.name,
        target_url: payload.target_url,
        secret: Uuid::new_v4().to_string(), // In real life, secure random
        events: payload.events,
        is_active: true,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    webhooks.push(webhook.clone());
    (StatusCode::CREATED, Json(webhook))
}

pub async fn get_webhook(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<Webhook>, StatusCode> {
    let webhooks = db.webhooks.read().await;
    if let Some(w) = webhooks.iter().find(|w| w.id == id) {
        Ok(Json(w.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn list_webhooks(State(db): State<MockDb>) -> Json<PaginatedResponse<Webhook>> {
    let webhooks = db.webhooks.read().await;
    let data = webhooks.clone();
    Json(PaginatedResponse {
        total: data.len(),
        data,
        page: 1,
        limit: 100,
    })
}

pub async fn update_webhook(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<WebhookUpdatePayload>,
) -> Result<Json<Webhook>, StatusCode> {
    let mut webhooks = db.webhooks.write().await;
    if let Some(w) = webhooks.iter_mut().find(|w| w.id == id) {
        if let Some(name) = payload.name {
            w.name = name;
        }
        if let Some(url) = payload.target_url {
            w.target_url = url;
        }
        if let Some(events) = payload.events {
            w.events = events;
        }
        if let Some(active) = payload.is_active {
            w.is_active = active;
        }
        w.updated_at = Utc::now();
        Ok(Json(w.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_webhook(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut webhooks = db.webhooks.write().await;
    let initial_len = webhooks.len();
    webhooks.retain(|w| w.id != id);
    if webhooks.len() < initial_len {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn bulk_create_webhooks(
    State(db): State<MockDb>,
    Json(payloads): Json<Vec<WebhookCreatePayload>>,
) -> (StatusCode, Json<Vec<Webhook>>) {
    let mut webhooks = db.webhooks.write().await;
    let mut created = Vec::new();
    for p in payloads {
        let w = Webhook {
            id: Uuid::new_v4(),
            name: p.name,
            target_url: p.target_url,
            secret: Uuid::new_v4().to_string(),
            events: p.events,
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        webhooks.push(w.clone());
        created.push(w);
    }
    (StatusCode::CREATED, Json(created))
}

#[derive(Deserialize)]
pub struct TriggerPayload {
    pub event_type: String,
    pub data: serde_json::Value,
}

pub async fn trigger_webhook_event(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<TriggerPayload>,
) -> Result<(StatusCode, Json<EventDelivery>), StatusCode> {
    let webhooks = db.webhooks.read().await;
    if let Some(_) = webhooks.iter().find(|w| w.id == id) {
        let mut deliveries = db.event_deliveries.write().await;
        let delivery = EventDelivery {
            id: Uuid::new_v4(),
            webhook_id: id,
            event_type: payload.event_type,
            payload: payload.data,
            status: DeliveryStatus::Pending,
            response_code: None,
            error_message: None,
            created_at: Utc::now(),
            next_retry_at: None,
            retry_count: 0,
        };
        deliveries.push(delivery.clone());
        Ok((StatusCode::ACCEPTED, Json(delivery)))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn get_webhook_stats(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let deliveries = db.event_deliveries.read().await;
    let count = deliveries.iter().filter(|d| d.webhook_id == id).count();
    let failed = deliveries
        .iter()
        .filter(|d| d.webhook_id == id && d.status == DeliveryStatus::Failed)
        .count();
    Ok(Json(serde_json::json!({
        "webhook_id": id,
        "total_deliveries": count,
        "failed_deliveries": failed,
    })))
}

// EventDelivery Handlers
pub async fn get_event_delivery(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<EventDelivery>, StatusCode> {
    let deliveries = db.event_deliveries.read().await;
    if let Some(d) = deliveries.iter().find(|d| d.id == id) {
        Ok(Json(d.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn list_event_deliveries(
    State(db): State<MockDb>,
) -> Json<PaginatedResponse<EventDelivery>> {
    let deliveries = db.event_deliveries.read().await;
    let data = deliveries.clone();
    Json(PaginatedResponse {
        total: data.len(),
        data,
        page: 1,
        limit: 100,
    })
}

pub async fn retry_event_delivery(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<EventDelivery>, StatusCode> {
    let mut deliveries = db.event_deliveries.write().await;
    if let Some(d) = deliveries.iter_mut().find(|d| d.id == id) {
        d.status = DeliveryStatus::Retrying;
        d.retry_count += 1;
        Ok(Json(d.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_event_delivery(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut deliveries = db.event_deliveries.write().await;
    let initial = deliveries.len();
    deliveries.retain(|d| d.id != id);
    if deliveries.len() < initial {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn list_event_deliveries_for_webhook(
    State(db): State<MockDb>,
    Path(webhook_id): Path<Uuid>,
) -> Json<PaginatedResponse<EventDelivery>> {
    let deliveries = db.event_deliveries.read().await;
    let data: Vec<_> = deliveries
        .iter()
        .filter(|d| d.webhook_id == webhook_id)
        .cloned()
        .collect();
    let total = data.len();
    Json(PaginatedResponse {
        total,
        data,
        page: 1,
        limit: 100,
    })
}

pub async fn clear_failed_deliveries(State(db): State<MockDb>) -> StatusCode {
    let mut deliveries = db.event_deliveries.write().await;
    deliveries.retain(|d| d.status != DeliveryStatus::Failed);
    StatusCode::NO_CONTENT
}

// ApiKey Handlers
pub async fn generate_api_key(
    State(db): State<MockDb>,
    Json(payload): Json<ApiKeyGeneratePayload>,
) -> (StatusCode, Json<ApiKeyGenerateResponse>) {
    let mut keys = db.api_keys.write().await;
    let plain_key = format!("sk_{}", Uuid::new_v4().simple());

    let expires_at = payload
        .expires_in_days
        .map(|d| Utc::now() + Duration::days(d));

    let key = ApiKey {
        id: Uuid::new_v4(),
        name: payload.name,
        key_prefix: plain_key[0..7].to_string(),
        key_hash: format!("hashed_{}", plain_key),
        is_revoked: false,
        created_at: Utc::now(),
        expires_at,
    };
    keys.push(key.clone());
    (
        StatusCode::CREATED,
        Json(ApiKeyGenerateResponse {
            api_key: key,
            plain_key,
        }),
    )
}

pub async fn get_api_key(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiKey>, StatusCode> {
    let keys = db.api_keys.read().await;
    if let Some(k) = keys.iter().find(|k| k.id == id) {
        Ok(Json(k.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn list_api_keys(State(db): State<MockDb>) -> Json<PaginatedResponse<ApiKey>> {
    let keys = db.api_keys.read().await;
    let data = keys.clone();
    Json(PaginatedResponse {
        total: data.len(),
        data,
        page: 1,
        limit: 100,
    })
}

pub async fn revoke_api_key(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiKey>, StatusCode> {
    let mut keys = db.api_keys.write().await;
    if let Some(k) = keys.iter_mut().find(|k| k.id == id) {
        k.is_revoked = true;
        Ok(Json(k.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

#[derive(Deserialize)]
pub struct ApiKeyRenamePayload {
    pub name: String,
}

pub async fn rename_api_key(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ApiKeyRenamePayload>,
) -> Result<Json<ApiKey>, StatusCode> {
    let mut keys = db.api_keys.write().await;
    if let Some(k) = keys.iter_mut().find(|k| k.id == id) {
        k.name = payload.name;
        Ok(Json(k.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// OauthApp Handlers
pub async fn register_oauth_app(
    State(db): State<MockDb>,
    Json(payload): Json<OauthAppCreatePayload>,
) -> (StatusCode, Json<OauthApp>) {
    let mut apps = db.oauth_apps.write().await;
    let app = OauthApp {
        id: Uuid::new_v4(),
        name: payload.name,
        client_id: Uuid::new_v4().to_string(),
        client_secret_hash: "secret_hash".to_string(),
        redirect_uris: payload.redirect_uris,
        scopes: payload.scopes,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    apps.push(app.clone());
    (StatusCode::CREATED, Json(app))
}

pub async fn get_oauth_app(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<OauthApp>, StatusCode> {
    let apps = db.oauth_apps.read().await;
    if let Some(a) = apps.iter().find(|a| a.id == id) {
        Ok(Json(a.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn list_oauth_apps(State(db): State<MockDb>) -> Json<PaginatedResponse<OauthApp>> {
    let apps = db.oauth_apps.read().await;
    let data = apps.clone();
    Json(PaginatedResponse {
        total: data.len(),
        data,
        page: 1,
        limit: 100,
    })
}

pub async fn update_oauth_app(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<OauthAppUpdatePayload>,
) -> Result<Json<OauthApp>, StatusCode> {
    let mut apps = db.oauth_apps.write().await;
    if let Some(a) = apps.iter_mut().find(|a| a.id == id) {
        if let Some(name) = payload.name {
            a.name = name;
        }
        if let Some(uris) = payload.redirect_uris {
            a.redirect_uris = uris;
        }
        if let Some(scopes) = payload.scopes {
            a.scopes = scopes;
        }
        a.updated_at = Utc::now();
        Ok(Json(a.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_oauth_app(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut apps = db.oauth_apps.write().await;
    let initial = apps.len();
    apps.retain(|a| a.id != id);
    if apps.len() < initial {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn rotate_oauth_secret(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut apps = db.oauth_apps.write().await;
    if let Some(a) = apps.iter_mut().find(|a| a.id == id) {
        let new_secret = Uuid::new_v4().to_string();
        a.client_secret_hash = format!("hashed_{}", new_secret);
        a.updated_at = Utc::now();
        Ok(Json(serde_json::json!({
            "client_id": a.client_id,
            "new_client_secret": new_secret,
        })))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn get_oauth_app_analytics(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let apps = db.oauth_apps.read().await;
    if let Some(a) = apps.iter().find(|a| a.id == id) {
        Ok(Json(serde_json::json!({
            "app_id": a.id,
            "total_users": 42,
            "api_calls_today": 1337,
        })))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
