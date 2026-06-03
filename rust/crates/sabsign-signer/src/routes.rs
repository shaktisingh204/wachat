use crate::handlers::*;
use crate::mock_db::Db;
use axum::{
    routing::{delete, get, post},
    Router,
};

pub fn app_router(db: Db) -> Router {
    Router::new()
        .route("/ping", get(ping))
        .route("/session/:token", get(validate_session))
        .route("/session/:token/document", get(get_document_info))
        .route("/session/:token/agreement", get(get_agreement_info))
        .route(
            "/session/:token/signer",
            get(get_signer_info).put(update_signer_info),
        )
        .route("/session/:token/fields", get(list_signature_fields))
        .route("/session/:token/fields/status", get(get_all_fields_status))
        .route(
            "/session/:token/signatures",
            get(get_adopted_signatures).post(adopt_signature),
        )
        .route(
            "/session/:token/signatures/:sig_id",
            delete(delete_adopted_signature),
        )
        .route("/session/:token/verification", post(start_verification))
        .route(
            "/session/:token/verification/:ver_id",
            get(check_verification_status).post(complete_verification),
        )
        .route(
            "/session/:token/fields/:field_id/apply",
            post(apply_signature_to_field),
        )
        .route(
            "/session/:token/fields/:field_id/remove",
            post(remove_signature_from_field),
        )
        .route("/session/:token/finalize", post(finalize_agreement))
        .route("/session/:token/decline", post(decline_agreement))
        .route("/session/:token/download", get(download_document))
        .route("/session/:token/audit", get(get_audit_logs))
        .route("/session/:token/other-signers", get(list_other_signers))
        .with_state(db)
}
