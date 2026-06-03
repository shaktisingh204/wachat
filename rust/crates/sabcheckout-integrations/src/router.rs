//! Mountable router. Mount under `/v1/sabcheckout/integrations`.

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
            get(handlers::list_integrations).post(handlers::create_integration),
        )
        .route(
            "/{integrationId}",
            get(handlers::get_integration)
                .patch(handlers::update_integration)
                .delete(handlers::delete_integration),
        )
}
