use crate::handlers::*;
use crate::mock_db::AppState;
use axum::{
    routing::{get, patch, post},
    Router,
};

pub fn create_router() -> Router {
    let state = AppState::new();

    Router::new()
        .route("/surveys", post(create_survey).get(list_surveys))
        .route(
            "/surveys/:id",
            get(get_survey).put(update_survey).delete(delete_survey),
        )
        .route("/surveys/bulk", post(bulk_create_surveys))
        .route("/surveys/:id/deactivate", patch(deactivate_survey))
        .route("/surveys/:id/activate", patch(activate_survey))
        .route("/surveys/status", get(list_surveys_by_status))
        .route("/surveys/search", get(search_surveys))
        .route(
            "/surveys/:survey_id/responses",
            post(submit_response).get(list_responses_for_survey),
        )
        .route("/responses", get(list_all_responses))
        .route("/responses/:id", get(get_response).delete(delete_response))
        .route("/responses/user/:user_id", get(get_responses_by_user))
        .route("/responses/ticket/:ticket_id", get(get_responses_by_ticket))
        .route("/surveys/:survey_id/analytics", get(get_survey_analytics))
        .route("/surveys/:survey_id/analytics/nps", get(get_nps_analytics))
        .route(
            "/surveys/:survey_id/analytics/csat",
            get(get_csat_analytics),
        )
        .with_state(state)
}
