//! Mountable router. Mount under `/v1/crm/candidates`.

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
            get(handlers::list_candidates).post(handlers::create_candidate),
        )
        .route(
            "/{candidateId}",
            get(handlers::get_candidate)
                .patch(handlers::update_candidate)
                .delete(handlers::delete_candidate),
        )
}
