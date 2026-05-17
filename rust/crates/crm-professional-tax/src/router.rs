//! Mountable router. Mount under `/v1/crm/professional-tax`.

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
        .route("/", get(handlers::list_pt).post(handlers::create_pt))
        .route(
            "/{recordId}",
            get(handlers::get_pt)
                .patch(handlers::update_pt)
                .delete(handlers::delete_pt),
        )
}
