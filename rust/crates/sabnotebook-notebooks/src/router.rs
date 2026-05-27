//! Mountable router. Mount under `/v1/sabnotebook/notebooks`.

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
            get(handlers::list_notebooks).post(handlers::create_notebook),
        )
        .route(
            "/{notebookId}",
            get(handlers::get_notebook)
                .patch(handlers::update_notebook)
                .delete(handlers::delete_notebook),
        )
}
