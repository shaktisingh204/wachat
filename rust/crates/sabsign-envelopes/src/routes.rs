use crate::handlers::*;
use crate::mock_db::AppState;
use axum::{
    routing::{delete, get, post, put},
    Router,
};

pub fn app_routes(state: AppState) -> Router {
    Router::new()
        .route("/envelopes", post(create_envelope).get(list_envelopes))
        .route("/envelopes/filter", get(filter_envelopes))
        .route("/envelopes/:id", get(get_envelope).delete(delete_envelope))
        .route(
            "/envelopes/:id/documents",
            post(add_document).get(list_documents),
        )
        .route(
            "/envelopes/:id/documents/:doc_id",
            get(get_document).delete(delete_document),
        )
        .route(
            "/envelopes/:id/recipients",
            post(add_recipient).get(list_recipients),
        )
        .route(
            "/envelopes/:id/recipients/:rec_id",
            delete(delete_recipient),
        )
        .route(
            "/envelopes/:id/recipients/:rec_id/placements",
            post(add_signature_placement),
        )
        .route("/envelopes/:id/send", post(send_envelope))
        .route("/envelopes/:id/void", post(void_envelope))
        .route("/envelopes/:id/routing", get(calculate_routing))
        .route("/envelopes/:id/routing/advance", post(advance_routing))
        .route("/envelopes/:id/reminders", put(set_reminder_settings))
        .route("/envelopes/:id/expires", put(set_expire_settings))
        .route("/envelopes/:id/audit", get(get_envelope_audit_trail))
        .route("/admin/reminders/dispatch", post(dispatch_reminders))
        .with_state(state)
}
