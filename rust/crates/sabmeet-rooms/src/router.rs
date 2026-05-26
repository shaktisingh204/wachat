//! Mountable router. Mount under `/v1/sabmeet/rooms`.

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
        .route("/", get(handlers::list_rooms).post(handlers::create_room))
        .route(
            "/{roomId}",
            get(handlers::get_room)
                .patch(handlers::update_room)
                .delete(handlers::delete_room),
        )
}
