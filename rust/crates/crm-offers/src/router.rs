//! Mountable router. Mount under `/v1/crm/offers`.

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
        .route("/", get(handlers::list_offers).post(handlers::create_offer))
        .route(
            "/{offerId}",
            get(handlers::get_offer)
                .patch(handlers::update_offer)
                .delete(handlers::delete_offer),
        )
}
