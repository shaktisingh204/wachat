//! Mountable router. Mount under `/v1/sabbackstage/orders`.
//!
//! Admin reads + status patches. Public create + confirm + read are
//! unauthenticated — they back the public checkout flow.

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
        .route("/", get(handlers::list_orders))
        .route(
            "/{id}",
            get(handlers::get_order)
                .patch(handlers::update_order)
                .delete(handlers::delete_order),
        )
        .route("/public/create", post(handlers::public_create_order))
        .route(
            "/public/{id}/confirm",
            post(handlers::public_confirm_order),
        )
        .route("/public/{id}", get(handlers::public_get_order))
}
