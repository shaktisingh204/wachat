use axum::{
    routing::{get, post, delete},
    Router,
};
use crate::handlers::*;
use crate::mock_db::Db;

pub fn create_router(db: Db) -> Router {
    Router::new()
        // Analytics
        .route("/analytics", get(get_analytics))
        
        // Apps
        .route("/apps", get(get_apps).post(create_app))
        .route("/apps/bulk-delete", post(bulk_delete_apps))
        .route("/apps/:id", get(get_app).put(update_app).delete(delete_app))
        
        // Webhooks
        .route("/apps/:id/webhooks", get(get_app_webhooks).post(create_webhook))
        .route("/webhooks", get(get_webhooks))
        .route("/webhooks/:id", delete(delete_webhook))
        .route("/webhooks/:id/toggle", post(toggle_webhook_status))
        
        // API Logs
        .route("/logs", get(get_api_logs))
        .route("/apps/:id/logs", get(get_app_api_logs).delete(clear_app_api_logs))
        
        // App Secrets
        .route("/apps/:id/secrets", get(get_app_secrets).post(create_app_secret))
        .route("/secrets/:id", delete(delete_app_secret))
        
        // Sync Jobs
        .route("/apps/:id/sync", get(get_sync_jobs).post(trigger_sync_job))
        .route("/sync/:id", get(get_sync_job))
        .route("/sync/:id/cancel", post(cancel_sync_job))
        
        .with_state(db)
}
