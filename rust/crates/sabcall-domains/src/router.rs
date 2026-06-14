//! Mountable router. Mount under `/v1/sabcall/domains`.

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
            get(handlers::list_domains).post(handlers::create_domain),
        )
        .route(
            "/{domainId}",
            get(handlers::get_domain)
                .patch(handlers::update_domain)
                .delete(handlers::delete_domain),
        )
}
