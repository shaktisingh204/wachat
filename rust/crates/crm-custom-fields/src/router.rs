//! Mountable router. Mount under `/v1/crm/custom-fields`.

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
            get(handlers::list_custom_fields).post(handlers::create_custom_field),
        )
        .route(
            "/{fieldId}",
            get(handlers::get_custom_field)
                .patch(handlers::update_custom_field)
                .delete(handlers::delete_custom_field),
        )
}
