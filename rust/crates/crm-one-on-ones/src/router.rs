//! Mountable router. Mount under `/v1/crm/one-on-ones`.

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
            get(handlers::list_one_on_ones).post(handlers::create_one_on_one),
        )
        .route(
            "/{oneOnOneId}",
            get(handlers::get_one_on_one)
                .patch(handlers::update_one_on_one)
                .delete(handlers::delete_one_on_one),
        )
}
