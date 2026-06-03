use crate::handlers::*;
use crate::mock_db::AppState;
use axum::{
    routing::{get, post},
    Router,
};

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        // Audit Events
        .route("/api/audit-events", post(create_audit_event))
        .route("/api/audit-events/bulk", post(bulk_create_audit_events))
        .route(
            "/api/audit-events/:id",
            get(get_audit_event_by_id).delete(delete_audit_event),
        )
        .route(
            "/api/audit-events/document/:doc_id",
            get(list_audit_events_for_document),
        )
        .route(
            "/api/audit-events/user/:user_id",
            get(list_audit_events_by_user),
        )
        .route("/api/audit-events/filter", post(filter_audit_events))
        .route(
            "/api/audit-events/export/:doc_id",
            get(export_audit_events_csv),
        )
        // Stats and Analytics
        .route(
            "/api/audit-events/stats/overview",
            get(get_audit_statistics),
        )
        .route("/api/audit-events/stats/ip-logs", get(get_ip_log_analytics))
        // Crypto Hashes
        .route("/api/crypto/hash", post(record_crypto_hash))
        .route("/api/crypto/verify", post(verify_crypto_hash))
        .route("/api/crypto/document/:doc_id", get(list_document_hashes))
        .route(
            "/api/crypto/document/:doc_id/latest",
            get(get_latest_document_hash),
        )
        // Certificates
        .route(
            "/api/certificates",
            get(list_all_certificates).post(generate_certificate),
        )
        .route(
            "/api/certificates/:id",
            get(get_certificate_by_id)
                .delete(delete_certificate)
                .put(update_certificate_metadata),
        )
        .route(
            "/api/certificates/document/:doc_id",
            get(get_certificate_for_document),
        )
        // System
        .route("/api/system/event", post(record_system_event))
        .with_state(state)
}
