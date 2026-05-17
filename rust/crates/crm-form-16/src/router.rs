//! Mountable router. Mount under `/v1/crm/form-16`.

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
            get(handlers::list_form_16s).post(handlers::create_form_16),
        )
        .route(
            "/{formId}",
            get(handlers::get_form_16)
                .patch(handlers::update_form_16)
                .delete(handlers::delete_form_16),
        )
}
