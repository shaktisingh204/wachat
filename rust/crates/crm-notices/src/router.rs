//! Mountable router. Mount under `/v1/crm/notices`.

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
            get(handlers::list_notices).post(handlers::create_notice),
        )
        .route(
            "/{noticeId}",
            get(handlers::get_notice)
                .patch(handlers::update_notice)
                .delete(handlers::delete_notice),
        )
}
