//! Mount under `/v1/pagesense/funnels`.

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
        .route("/", get(handlers::list_funnels).post(handlers::create_funnel))
        .route(
            "/{funnelId}",
            get(handlers::get_funnel)
                .patch(handlers::update_funnel)
                .delete(handlers::delete_funnel),
        )
}
