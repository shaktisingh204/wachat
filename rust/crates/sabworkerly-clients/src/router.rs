//! Mountable router for SabWorkerly clients.

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
        .route("/", get(handlers::list_clients).post(handlers::create_client))
        .route(
            "/{clientId}",
            get(handlers::get_client)
                .patch(handlers::update_client)
                .delete(handlers::delete_client),
        )
}
