//! Mountable router. Mount under `/v1/sabcreator/roles`.

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
        .route("/", get(handlers::list_roles).post(handlers::create_role))
        .route(
            "/{roleId}",
            get(handlers::get_role)
                .patch(handlers::update_role)
                .delete(handlers::delete_role),
        )
}
