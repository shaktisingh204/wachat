//! Mountable router. Mount under `/v1/crm/hire`.

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
        .route("/", get(handlers::list_hires).post(handlers::create_hire))
        .route(
            "/{hireId}",
            get(handlers::get_hire)
                .patch(handlers::update_hire)
                .delete(handlers::delete_hire),
        )
}
