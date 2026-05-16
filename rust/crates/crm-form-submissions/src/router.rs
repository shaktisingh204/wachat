//! Mountable router. Mount under `/v1/crm/form-submissions`.

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
            get(handlers::list_submissions).post(handlers::create_submission),
        )
        .route(
            "/{submissionId}",
            get(handlers::get_submission)
                .patch(handlers::update_submission)
                .delete(handlers::delete_submission),
        )
}
