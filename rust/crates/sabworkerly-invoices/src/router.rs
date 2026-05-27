//! Mountable router for SabWorkerly invoices.

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
        .route("/", get(handlers::list_invoices).post(handlers::create_invoice))
        .route(
            "/{invoiceId}",
            get(handlers::get_invoice)
                .patch(handlers::update_invoice)
                .delete(handlers::delete_invoice),
        )
}
