//! Mountable router. Mount under `/v1/sabtables/views`.

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
        .route("/", get(handlers::list_views).post(handlers::create_view))
        .route(
            "/{viewId}",
            get(handlers::get_view)
                .patch(handlers::update_view)
                .delete(handlers::delete_view),
        )
        .route("/form/{formToken}", get(handlers::get_form_view_public))
}
