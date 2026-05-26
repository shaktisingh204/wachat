//! Mountable router. Mount under `/v1/sabrewards/programs`.

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
            get(handlers::list_programs).post(handlers::create_program),
        )
        .route(
            "/{programId}",
            get(handlers::get_program)
                .patch(handlers::update_program)
                .delete(handlers::delete_program),
        )
}
