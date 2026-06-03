use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;
use chrono::Utc;


use crate::models::*;
use crate::mock_db::Db;

// --- Apps Handlers ---

pub async fn create_app(
    State(db): State<Db>,
    Json(payload): Json<CreateAppRequest>,
) -> impl IntoResponse {
    let mut db_write = db.write().await;
    let app = InstalledApp {
        id: Uuid::new_v4(),
        name: payload.name,
        provider: payload.provider,
        status: AppStatus::Active,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        settings: payload.settings,
    };
    db_write.apps.insert(app.id, app.clone());
    (StatusCode::CREATED, Json(app))
}

pub async fn get_apps(State(db): State<Db>) -> impl IntoResponse {
    let db_read = db.read().await;
    let apps: Vec<InstalledApp> = db_read.apps.values().cloned().collect();
    (StatusCode::OK, Json(apps))
}

pub async fn get_app(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let db_read = db.read().await;
    if let Some(app) = db_read.apps.get(&id) {
        (StatusCode::OK, Json(app.clone())).into_response()
    } else {
        (StatusCode::NOT_FOUND, "App not found").into_response()
    }
}

pub async fn update_app(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAppRequest>,
) -> impl IntoResponse {
    let mut db_write = db.write().await;
    if let Some(app) = db_write.apps.get_mut(&id) {
        if let Some(name) = payload.name {
            app.name = name;
        }
        if let Some(status) = payload.status {
            app.status = status;
        }
        if let Some(settings) = payload.settings {
            app.settings = settings;
        }
        app.updated_at = Utc::now();
        (StatusCode::OK, Json(app.clone())).into_response()
    } else {
        (StatusCode::NOT_FOUND, "App not found").into_response()
    }
}

pub async fn delete_app(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mut db_write = db.write().await;
    if db_write.apps.remove(&id).is_some() {
        // Also clean up related entities
        db_write.webhooks.retain(|_, v| v.app_id != id);
        db_write.app_secrets.retain(|_, v| v.app_id != id);
        db_write.api_logs.retain(|_, v| v.app_id != id);
        db_write.sync_jobs.retain(|_, v| v.app_id != id);
        StatusCode::NO_CONTENT.into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

pub async fn bulk_delete_apps(
    State(db): State<Db>,
    Json(payload): Json<BulkDeleteRequest>,
) -> impl IntoResponse {
    let mut db_write = db.write().await;
    let mut deleted_count = 0;
    for id in payload.ids {
        if db_write.apps.remove(&id).is_some() {
            deleted_count += 1;
            db_write.webhooks.retain(|_, v| v.app_id != id);
            db_write.app_secrets.retain(|_, v| v.app_id != id);
        }
    }
    (StatusCode::OK, Json(serde_json::json!({ "deleted": deleted_count })))
}

// --- Webhooks Handlers ---

pub async fn create_webhook(
    State(db): State<Db>,
    Path(app_id): Path<Uuid>,
    Json(payload): Json<CreateWebhookRequest>,
) -> impl IntoResponse {
    let mut db_write = db.write().await;
    if !db_write.apps.contains_key(&app_id) {
        return (StatusCode::NOT_FOUND, "App not found").into_response();
    }
    
    let webhook = WebhookSubscription {
        id: Uuid::new_v4(),
        app_id,
        target_url: payload.target_url,
        events: payload.events,
        is_active: true,
        secret_key: Some(Uuid::new_v4().to_string()),
        created_at: Utc::now(),
        last_delivery_at: None,
    };
    db_write.webhooks.insert(webhook.id, webhook.clone());
    (StatusCode::CREATED, Json(webhook)).into_response()
}

pub async fn get_webhooks(State(db): State<Db>) -> impl IntoResponse {
    let db_read = db.read().await;
    let wh: Vec<WebhookSubscription> = db_read.webhooks.values().cloned().collect();
    (StatusCode::OK, Json(wh))
}

pub async fn get_app_webhooks(
    State(db): State<Db>,
    Path(app_id): Path<Uuid>,
) -> impl IntoResponse {
    let db_read = db.read().await;
    let wh: Vec<WebhookSubscription> = db_read.webhooks.values()
        .filter(|v| v.app_id == app_id)
        .cloned()
        .collect();
    (StatusCode::OK, Json(wh))
}

pub async fn delete_webhook(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mut db_write = db.write().await;
    if db_write.webhooks.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn toggle_webhook_status(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mut db_write = db.write().await;
    if let Some(wh) = db_write.webhooks.get_mut(&id) {
        wh.is_active = !wh.is_active;
        (StatusCode::OK, Json(wh.clone())).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

// --- API Logs Handlers ---

pub async fn get_api_logs(State(db): State<Db>) -> impl IntoResponse {
    let db_read = db.read().await;
    let mut logs: Vec<ApiLog> = db_read.api_logs.values().cloned().collect();
    logs.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    (StatusCode::OK, Json(logs))
}

pub async fn get_app_api_logs(
    State(db): State<Db>,
    Path(app_id): Path<Uuid>,
) -> impl IntoResponse {
    let db_read = db.read().await;
    let mut logs: Vec<ApiLog> = db_read.api_logs.values()
        .filter(|v| v.app_id == app_id)
        .cloned()
        .collect();
    logs.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    (StatusCode::OK, Json(logs))
}

pub async fn clear_app_api_logs(
    State(db): State<Db>,
    Path(app_id): Path<Uuid>,
) -> impl IntoResponse {
    let mut db_write = db.write().await;
    db_write.api_logs.retain(|_, v| v.app_id != app_id);
    StatusCode::NO_CONTENT
}

// --- App Secrets Handlers ---

#[derive(serde::Deserialize)]
pub struct CreateSecretRequest {
    pub key_name: String,
    pub key_value: String,
}

pub async fn create_app_secret(
    State(db): State<Db>,
    Path(app_id): Path<Uuid>,
    Json(payload): Json<CreateSecretRequest>,
) -> impl IntoResponse {
    let mut db_write = db.write().await;
    if !db_write.apps.contains_key(&app_id) {
        return (StatusCode::NOT_FOUND, "App not found").into_response();
    }
    
    let secret = AppSecret {
        id: Uuid::new_v4(),
        app_id,
        key_name: payload.key_name,
        key_value_encrypted: format!("enc_{}", payload.key_value), // Mock enc
        expires_at: None,
        created_at: Utc::now(),
    };
    db_write.app_secrets.insert(secret.id, secret.clone());
    (StatusCode::CREATED, Json(secret)).into_response()
}

pub async fn get_app_secrets(
    State(db): State<Db>,
    Path(app_id): Path<Uuid>,
) -> impl IntoResponse {
    let db_read = db.read().await;
    let secrets: Vec<AppSecret> = db_read.app_secrets.values()
        .filter(|v| v.app_id == app_id)
        .cloned()
        .collect();
    (StatusCode::OK, Json(secrets)).into_response()
}

pub async fn delete_app_secret(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mut db_write = db.write().await;
    if db_write.app_secrets.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// --- Sync Jobs Handlers ---

pub async fn trigger_sync_job(
    State(db): State<Db>,
    Path(app_id): Path<Uuid>,
    Json(payload): Json<TriggerSyncRequest>,
) -> impl IntoResponse {
    let mut db_write = db.write().await;
    if !db_write.apps.contains_key(&app_id) {
        return (StatusCode::NOT_FOUND, "App not found").into_response();
    }
    
    let job = SyncJob {
        id: Uuid::new_v4(),
        app_id,
        entity_type: payload.entity_type,
        status: SyncStatus::Pending,
        records_processed: 0,
        total_records: None,
        started_at: None,
        finished_at: None,
        created_at: Utc::now(),
        error_details: None,
    };
    db_write.sync_jobs.insert(job.id, job.clone());
    (StatusCode::CREATED, Json(job)).into_response()
}

pub async fn get_sync_jobs(
    State(db): State<Db>,
    Path(app_id): Path<Uuid>,
) -> impl IntoResponse {
    let db_read = db.read().await;
    let jobs: Vec<SyncJob> = db_read.sync_jobs.values()
        .filter(|v| v.app_id == app_id)
        .cloned()
        .collect();
    (StatusCode::OK, Json(jobs)).into_response()
}

pub async fn get_sync_job(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let db_read = db.read().await;
    if let Some(job) = db_read.sync_jobs.get(&id) {
        (StatusCode::OK, Json(job.clone())).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

pub async fn cancel_sync_job(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mut db_write = db.write().await;
    if let Some(job) = db_write.sync_jobs.get_mut(&id) {
        if job.status == SyncStatus::Pending || job.status == SyncStatus::Running {
            job.status = SyncStatus::Failed;
            job.error_details = Some("Cancelled by user".to_string());
            job.finished_at = Some(Utc::now());
            (StatusCode::OK, Json(job.clone())).into_response()
        } else {
            (StatusCode::BAD_REQUEST, "Job cannot be cancelled").into_response()
        }
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

// --- Analytics ---

pub async fn get_analytics(State(db): State<Db>) -> impl IntoResponse {
    let db_read = db.read().await;
    
    let total_apps = db_read.apps.len();
    let active_apps = db_read.apps.values().filter(|a| a.status == AppStatus::Active).count();
    let total_webhooks = db_read.webhooks.len();
    
    // Mocking 24h count
    let total_api_calls_24h = db_read.api_logs.len();
    let sync_jobs_running = db_read.sync_jobs.values().filter(|j| j.status == SyncStatus::Running).count();
    
    let stats = AppAnalytics {
        total_apps,
        active_apps,
        total_webhooks,
        total_api_calls_24h,
        sync_jobs_running,
    };
    
    (StatusCode::OK, Json(stats))
}
