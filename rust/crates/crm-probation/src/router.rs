//! Mountable router. Mount under `/v1/crm/probations`.

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
            get(handlers::list_probations).post(handlers::create_probation),
        )
        .route(
            "/{probationId}",
            get(handlers::get_probation)
                .patch(handlers::update_probation)
                .delete(handlers::delete_probation),
        )
}
