//! Mountable router. Mount under `/v1/crm/surveys`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_surveys).post(handlers::create_survey),
        )
        .route(
            "/{surveyId}",
            get(handlers::get_survey)
                .patch(handlers::update_survey)
                .delete(handlers::delete_survey),
        )
}
