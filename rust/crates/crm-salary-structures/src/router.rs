//! Mountable router. Mount under `/v1/crm/salary-structures`.

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
            get(handlers::list_structures).post(handlers::create_structure),
        )
        .route(
            "/{structureId}",
            get(handlers::get_structure)
                .patch(handlers::update_structure)
                .delete(handlers::delete_structure),
        )
}
