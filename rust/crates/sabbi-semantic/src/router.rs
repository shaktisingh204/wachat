//! Mountable router. Mount under `/v1/sabbi/models`.

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
        .route("/", get(handlers::list_models).post(handlers::create_model))
        .route(
            "/{modelId}",
            get(handlers::get_model)
                .patch(handlers::update_model)
                .delete(handlers::delete_model),
        )
}
