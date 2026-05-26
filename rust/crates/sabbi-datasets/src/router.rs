//! Mountable router. Mount under `/v1/sabbi/datasets`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
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
            get(handlers::list_datasets).post(handlers::create_dataset),
        )
        .route(
            "/{datasetId}",
            get(handlers::get_dataset)
                .patch(handlers::update_dataset)
                .delete(handlers::delete_dataset),
        )
        .route("/{datasetId}/refresh", post(handlers::refresh_dataset))
        .route("/{datasetId}/preview", get(handlers::preview_dataset))
}
