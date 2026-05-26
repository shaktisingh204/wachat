//! Mountable router for the org chart endpoints.

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
            get(handlers::list_charts).post(handlers::upsert_chart),
        )
        .route("/resolve", get(handlers::resolve_manager))
        .route(
            "/{chartId}",
            axum::routing::patch(handlers::update_chart)
                .delete(handlers::delete_chart),
        )
}
