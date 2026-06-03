use crate::{handlers::*, mock_db::new_db};
use axum::{
    Router,
    routing::{delete, get, post, put},
};

pub fn app_router() -> Router {
    let db = new_db();

    Router::new()
        // Sessions
        .route("/sessions", post(create_session).get(list_sessions))
        .route("/sessions/bulk_delete", post(bulk_delete_sessions))
        .route("/sessions/analytics", get(get_session_analytics))
        .route("/sessions/:id", get(get_session).delete(delete_session))
        .route("/sessions/:id/status", put(update_session_status))
        .route("/sessions/:id/signers", post(add_signer_to_session))
        .route(
            "/sessions/:session_id/signers/:signer_id",
            delete(remove_signer_from_session),
        )
        .route("/sessions/:id/start", post(start_session))
        .route("/sessions/:id/complete", post(complete_session))
        // Identity Checks
        .route(
            "/sessions/:id/identity_checks",
            post(add_identity_check).get(get_identity_checks_for_session),
        )
        .route("/identity_checks/:id", get(get_identity_check))
        .route(
            "/sessions/:session_id/signers/:signer_id/verify",
            post(verify_signer),
        )
        // Video Recordings
        .route("/sessions/:id/recordings", post(add_video_recording))
        .route("/recordings", get(list_video_recordings))
        .route("/recordings/:id", get(get_video_recording))
        // Journals
        .route("/sessions/:id/journal", get(get_journal_by_session))
        .route("/journals/:id", get(get_journal))
        .route("/journals/:id/entries", post(add_journal_entry))
        .route("/journals/:id/seal", post(seal_journal))
        .route("/journals/:id/audit", post(audit_journal))
        .with_state(db)
}
