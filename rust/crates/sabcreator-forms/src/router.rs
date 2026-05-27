//! Mountable router. Mount under `/v1/sabcreator/forms`.

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
        .route("/", get(handlers::list_forms).post(handlers::create_form))
        .route(
            "/{formId}",
            get(handlers::get_form)
                .patch(handlers::update_form)
                .delete(handlers::delete_form),
        )
}
