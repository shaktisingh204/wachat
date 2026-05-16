//! Mountable router. Mount under `/v1/crm/industries` from the host `api` crate.

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
            get(handlers::list_industries).post(handlers::create_industry),
        )
        .route(
            "/{industryId}",
            get(handlers::get_industry)
                .patch(handlers::update_industry)
                .delete(handlers::delete_industry),
        )
}
