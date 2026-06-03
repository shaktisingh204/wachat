use axum::{
    routing::{get, post, put},
    Router,
};

use crate::{handlers::*, mock_db::SharedState};

pub fn build_router(state: SharedState) -> Router {
    Router::new()
        .route(
            "/api/v1/hardware-assets",
            post(create_hardware_asset).get(get_hardware_assets),
        )
        .route("/api/v1/hardware-assets/:id", get(get_hardware_asset))
        .route(
            "/api/v1/hardware-assets/:id/status",
            put(update_hardware_asset_status),
        )
        .route(
            "/api/v1/software-licenses",
            post(create_software_license).get(get_software_licenses),
        )
        .route(
            "/api/v1/software-licenses/:id/allocate",
            post(allocate_software_seat),
        )
        .route(
            "/api/v1/software-licenses/:id/deallocate",
            post(deallocate_software_seat),
        )
        .route(
            "/api/v1/incidents",
            post(create_incident).get(get_incidents),
        )
        .route("/api/v1/incidents/:id", get(get_incident))
        .route("/api/v1/incidents/:id/state", put(update_incident_state))
        .route(
            "/api/v1/incidents/:id/assign/:user_id",
            put(assign_incident),
        )
        .route(
            "/api/v1/incidents/:id/correlate/:asset_id",
            put(correlate_incident_with_asset),
        )
        .route("/api/v1/problems", post(create_problem).get(get_problems))
        .route("/api/v1/problems/:id/state", put(update_problem_state))
        .route(
            "/api/v1/problems/:id/link-incident/:incident_id",
            post(link_incident_to_problem),
        )
        .route(
            "/api/v1/change-requests",
            post(create_change_request).get(get_change_requests),
        )
        .route(
            "/api/v1/change-requests/:id/approve",
            post(approve_change_request),
        )
        .route(
            "/api/v1/change-requests/:id/schedule",
            put(schedule_change_request),
        )
        .with_state(state)
}
