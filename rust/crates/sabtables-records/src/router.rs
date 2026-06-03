//! Mountable router. Mount under `/v1/sabtables/records`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
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
            get(handlers::list_records).post(handlers::create_record),
        )
        .route(
            "/{recordId}",
            get(handlers::get_record)
                .patch(handlers::update_record)
                .delete(handlers::delete_record),
        )
        .route("/evaluate-formula", post(handlers::evaluate_formula))
}
