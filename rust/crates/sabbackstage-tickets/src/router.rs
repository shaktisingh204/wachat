//! Mountable router. Mount under `/v1/sabbackstage/tickets`.
//!
//! Admin CRUD + check-in. Public ticket retrieval by `orderId`
//! (unauthenticated) lives at `/public/by-order/:orderId` so buyers
//! can print their tickets right after checkout completes.

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
            get(handlers::list_tickets).post(handlers::issue_ticket),
        )
        .route("/check-in", post(handlers::check_in_ticket))
        .route(
            "/{id}",
            get(handlers::get_ticket)
                .patch(handlers::update_ticket)
                .delete(handlers::delete_ticket),
        )
        .route(
            "/public/by-order/{orderId}",
            get(handlers::public_list_by_order),
        )
}
