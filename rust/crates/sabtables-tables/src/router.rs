//! Mountable router. Mount under `/v1/sabtables/tables`.

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
        .route("/", get(handlers::list_tables).post(handlers::create_table))
        .route(
            "/{tableId}",
            get(handlers::get_table)
                .patch(handlers::update_table)
                .delete(handlers::delete_table),
        )
        .route("/{tableId}/fields", post(handlers::add_field))
        .route("/{tableId}/fields/update", post(handlers::update_field))
        .route(
            "/{tableId}/fields/{fieldId}/delete",
            post(handlers::delete_field),
        )
}
