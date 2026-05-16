//! Mountable router. Mount under `/v1/crm/units`.

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
        .route("/", get(handlers::list_units).post(handlers::create_unit))
        .route(
            "/{unitId}",
            get(handlers::get_unit)
                .patch(handlers::update_unit)
                .delete(handlers::delete_unit),
        )
}
