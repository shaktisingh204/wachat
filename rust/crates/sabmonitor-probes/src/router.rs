use crate::handlers;
use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;
use std::sync::Arc;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_probes).post(handlers::create_probe))
        .route(
            "/{probeId}",
            get(handlers::get_probe)
                .patch(handlers::update_probe)
                .delete(handlers::delete_probe),
        )
}
