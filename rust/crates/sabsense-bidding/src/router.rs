//! Mountable router. Mount under `/v1/sabsense/biddings`.

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
        .route("/", get(handlers::list_biddings).post(handlers::create_bidding))
        .route(
            "/{biddingId}",
            get(handlers::get_bidding)
                .patch(handlers::update_bidding)
                .delete(handlers::delete_bidding),
        )
}
