//! Mountable router. Mount under `/v1/crm/account-groups`.

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
        .route("/", get(handlers::list_groups).post(handlers::create_group))
        .route(
            "/{groupId}",
            get(handlers::get_group)
                .patch(handlers::update_group)
                .delete(handlers::delete_group),
        )
}
