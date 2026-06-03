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
        .route("/accounts", post(create_account).get(list_accounts))
        .route(
            "/accounts/:id",
            get(get_account).put(update_account).delete(delete_account),
        )
        .route("/accounts/:id/sync", post(sync_account))
        .route("/health-scores", post(create_health_score))
        .route("/health-scores/:id", get(get_health_score))
        .route(
            "/accounts/:account_id/health-scores",
            get(list_account_health_scores),
        )
        .route(
            "/accounts/:account_id/health-scores/calculate",
            post(calculate_health_score),
        )
        .route(
            "/qbr-templates",
            post(create_qbr_template).get(list_qbr_templates),
        )
        .route("/qbr-templates/:id", get(get_qbr_template))
        .route(
            "/accounts/:account_id/churn-predictions/predict",
            post(predict_churn),
        )
        .route("/churn-predictions/:id", get(get_churn_prediction))
        .route("/success-plans", post(create_success_plan))
        .route(
            "/success-plans/:id",
            get(get_success_plan).put(update_success_plan),
        )
        .route("/success-plans/:id/complete", post(complete_success_plan))
        .route(
            "/accounts/:account_id/success-plans",
            get(list_account_success_plans),
        )
        .with_state(db)
}
