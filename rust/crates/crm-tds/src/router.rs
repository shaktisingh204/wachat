//! Mountable router. Mount under `/v1/crm/tds`.

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
        .route("/", get(handlers::list_tds).post(handlers::create_tds))
        .route(
            "/{recordId}",
            get(handlers::get_tds)
                .patch(handlers::update_tds)
                .delete(handlers::delete_tds),
        )
}
