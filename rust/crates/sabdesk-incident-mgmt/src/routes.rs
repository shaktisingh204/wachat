use crate::handlers::*;
use crate::mock_db::MockDb;
use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;

pub fn create_router() -> Router {
    let db = Arc::new(MockDb::new());

    Router::new()
        .route("/incidents", get(list_incidents).post(create_incident))
        .route("/incidents/:id", get(get_incident).delete(delete_incident))
        .route("/incidents/:id/status", put(update_incident_status))
        .route("/incidents/:id/commander", put(assign_commander))
        .route(
            "/incidents/:incident_id/war-rooms",
            get(list_war_rooms).post(create_war_room),
        )
        .route(
            "/incidents/:incident_id/war-rooms/:room_id",
            get(get_war_room),
        )
        .route(
            "/incidents/:incident_id/war-rooms/:room_id/close",
            put(close_war_room),
        )
        .route(
            "/incidents/:incident_id/status-pages",
            get(list_status_pages).post(create_status_page),
        )
        .route(
            "/incidents/:incident_id/status-pages/:page_id",
            get(get_status_page)
                .put(update_status_page)
                .delete(delete_status_page),
        )
        .route(
            "/incidents/:incident_id/post-mortems",
            get(list_post_mortems).post(create_post_mortem),
        )
        .route(
            "/incidents/:incident_id/post-mortems/:pm_id",
            get(get_post_mortem).put(update_post_mortem),
        )
        .route(
            "/incidents/:incident_id/communications",
            get(list_communications).post(blast_communication),
        )
        .with_state(db)
}
