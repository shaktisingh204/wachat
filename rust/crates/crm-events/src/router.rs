//! Mountable router. Mount under `/v1/crm/events`.

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
        .route("/", get(handlers::list_events).post(handlers::create_event))
        .route(
            "/{eventId}",
            get(handlers::get_event)
                .patch(handlers::update_event)
                .delete(handlers::delete_event),
        )
}
