//! Mountable router. Mount under `/v1/sabmeet/dialins`.

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
        .route("/", get(handlers::list_dialins).post(handlers::create_dialin))
        .route(
            "/{dialinId}",
            axum::routing::patch(handlers::update_dialin)
                .delete(handlers::delete_dialin),
        )
}
