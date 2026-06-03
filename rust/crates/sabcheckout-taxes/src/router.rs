//! Mountable router. Mount under `/v1/sabcheckout/taxes`.

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
        .route("/", get(handlers::list_taxes).post(handlers::create_tax))
        .route(
            "/{id}",
            get(handlers::get_tax)
                .patch(handlers::update_tax)
                .delete(handlers::delete_tax),
        )
}
