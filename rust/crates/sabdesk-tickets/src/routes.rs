use crate::handlers::*;
use crate::mock_db::AppState;
use axum::{
    Router,
    routing::{delete, get, post, put},
};

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/tickets", post(create_ticket).get(list_tickets))
        .route(
            "/tickets/{id}",
            get(get_ticket).put(update_ticket).delete(delete_ticket),
        )
        .route(
            "/tickets/{id}/messages",
            post(add_ticket_message).get(get_ticket_messages),
        )
        .route("/tickets/{id}/assign", post(assign_ticket))
        .route("/tickets/{id}/status/{status}", put(change_ticket_status))
        .route("/tickets/{id}/tags", post(add_ticket_tag))
        .route("/tickets/{id}/tags/{tag_id}", delete(remove_ticket_tag))
        .route("/tickets/{id}/logs", get(get_ticket_activity_logs))
        .route("/tickets/bulk", post(bulk_update_tickets))
        .route("/tickets/filter", post(list_tickets))
        .route("/tickets/stats", get(get_ticket_statistics))
        .route("/users", post(create_user).get(list_users))
        .route("/users/{id}", get(get_user))
        .route("/views", post(create_ticket_view))
        .route("/views/{id}", get(get_ticket_view))
        .route("/views/{id}/execute", get(execute_ticket_view))
        .with_state(state)
}
