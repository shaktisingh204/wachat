//! Mountable router. Mount under `/v1/sabcheckout/gift_cards`.

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
            get(handlers::list_gift_cards).post(handlers::create_gift_card),
        )
        .route(
            "/{gift_cardId}",
            get(handlers::get_gift_card)
                .patch(handlers::update_gift_card)
                .delete(handlers::delete_gift_card),
        )
}
