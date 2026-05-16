//! Mountable router. Mount under `/v1/crm/pt-slabs`.

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
        .route("/", get(handlers::list_slabs).post(handlers::create_slab))
        .route(
            "/{slabId}",
            get(handlers::get_slab)
                .patch(handlers::update_slab)
                .delete(handlers::delete_slab),
        )
}
