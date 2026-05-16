//! Mountable router. Mount under `/v1/crm/labels` from the host `api` crate.

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
        .route("/", get(handlers::list_labels).post(handlers::create_label))
        .route(
            "/{labelId}",
            get(handlers::get_label)
                .patch(handlers::update_label)
                .delete(handlers::delete_label),
        )
}
