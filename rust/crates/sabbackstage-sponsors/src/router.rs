//! Mountable router. Mount under `/v1/sabbackstage/sponsors`.

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
            get(handlers::list_sponsors).post(handlers::create_sponsor),
        )
        .route(
            "/{id}",
            get(handlers::get_sponsor)
                .patch(handlers::update_sponsor)
                .delete(handlers::delete_sponsor),
        )
        .route(
            "/public/by-event/{eventId}",
            get(handlers::public_list_by_event),
        )
}
