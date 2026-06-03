use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::{handlers::*, mock_db::MockDb};

pub fn app_routes() -> Router<MockDb> {
    Router::new()
        // Webhooks
        .route("/webhooks", post(create_webhook).get(list_webhooks))
        .route("/webhooks/bulk", post(bulk_create_webhooks))
        .route(
            "/webhooks/:id",
            get(get_webhook).put(update_webhook).delete(delete_webhook),
        )
        .route("/webhooks/:id/trigger", post(trigger_webhook_event))
        .route("/webhooks/:id/stats", get(get_webhook_stats))
        // Event Deliveries
        .route(
            "/deliveries",
            get(list_event_deliveries).delete(clear_failed_deliveries),
        )
        .route(
            "/deliveries/:id",
            get(get_event_delivery).delete(delete_event_delivery),
        )
        .route("/deliveries/:id/retry", post(retry_event_delivery))
        .route(
            "/webhooks/:id/deliveries",
            get(list_event_deliveries_for_webhook),
        )
        // API Keys
        .route("/api-keys", post(generate_api_key).get(list_api_keys))
        .route("/api-keys/:id", get(get_api_key))
        .route("/api-keys/:id/revoke", post(revoke_api_key))
        .route("/api-keys/:id/rename", put(rename_api_key))
        // OAuth Apps
        .route("/oauth-apps", post(register_oauth_app).get(list_oauth_apps))
        .route(
            "/oauth-apps/:id",
            get(get_oauth_app)
                .put(update_oauth_app)
                .delete(delete_oauth_app),
        )
        .route("/oauth-apps/:id/rotate-secret", post(rotate_oauth_secret))
        .route("/oauth-apps/:id/analytics", get(get_oauth_app_analytics))
}
