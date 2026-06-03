//! Mountable router. Mount under `/v1/sabcheckout/alerts`.

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
        .route("/", get(handlers::list_alerts).post(handlers::create_alert))
        .route(
            "/{alertId}",
            get(handlers::get_alert)
                .patch(handlers::update_alert)
                .delete(handlers::delete_alert),
        )
}
