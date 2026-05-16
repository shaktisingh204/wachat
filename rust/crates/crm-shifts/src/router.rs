//! Mountable router. Mount under `/v1/crm/shifts`.

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
        .route("/", get(handlers::list_shifts).post(handlers::create_shift))
        .route(
            "/{shiftId}",
            get(handlers::get_shift)
                .patch(handlers::update_shift)
                .delete(handlers::delete_shift),
        )
}
