//! Mountable router. Mount under `/v1/crm/boms`.

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
        .route("/", get(handlers::list_boms).post(handlers::create_bom))
        .route(
            "/{bomId}",
            get(handlers::get_bom)
                .patch(handlers::update_bom)
                .delete(handlers::delete_bom),
        )
}
