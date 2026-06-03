use axum::{
    routing::{get, post, delete, put},
    Router,
};
use crate::handlers::*;
use crate::mock_db::MockDb;

pub fn create_router(db: MockDb) -> Router {
    Router::new()
        .route("/scorecards", post(create_scorecard).get(list_scorecards))
        .route("/scorecards/:id", get(get_scorecard).put(update_scorecard).delete(delete_scorecard))
        .route("/scorecards/:id/questions", post(add_question_to_scorecard))
        .route("/scorecards/:scorecard_id/questions/:question_id", delete(remove_question_from_scorecard))
        
        .route("/evaluations", post(submit_evaluation).get(list_evaluations))
        .route("/evaluations/:id", get(get_evaluation).put(update_evaluation).delete(delete_evaluation))
        .route("/evaluations/:id/score", post(calculate_evaluation_score))
        
        .route("/disputes", post(raise_dispute).get(list_disputes))
        .route("/disputes/:id", get(get_dispute))
        .route("/disputes/:id/resolve", post(resolve_dispute))
        .route("/disputes/:id/reject", post(reject_dispute))
        
        .route("/calibration-sessions", post(create_calibration_session).get(list_calibration_sessions))
        .route("/calibration-sessions/:id", get(get_calibration_session))
        .route("/calibration-sessions/:id/complete", post(complete_calibration_session))
        
        .route("/settings", get(get_settings).put(update_settings))
        
        .with_state(db)
}
