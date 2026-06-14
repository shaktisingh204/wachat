//! Mountable router. Mount under `/v1/sabcall/dids`.

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
        .route("/", get(handlers::list_dids).post(handlers::create_did))
        .route(
            "/{didId}",
            get(handlers::get_did)
                .patch(handlers::update_did)
                .delete(handlers::delete_did),
        )
}
