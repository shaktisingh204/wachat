//! Mountable router. Mount under `/v1/sabsense/direct_deals`.

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
        .route("/", get(handlers::list_direct_deals).post(handlers::create_direct_deal))
        .route(
            "/{direct_dealId}",
            get(handlers::get_direct_deal)
                .patch(handlers::update_direct_deal)
                .delete(handlers::delete_direct_deal),
        )
}
