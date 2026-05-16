//! Mountable router. Mount under `/v1/crm/training`.

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
            get(handlers::list_trainings).post(handlers::create_training),
        )
        .route(
            "/{trainingId}",
            get(handlers::get_training)
                .patch(handlers::update_training)
                .delete(handlers::delete_training),
        )
}
