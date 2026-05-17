//! Mountable router. Mount under `/v1/crm/recurring-invoices`.

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
            get(handlers::list_recurring_invoices).post(handlers::create_recurring_invoice),
        )
        .route(
            "/{recurringId}",
            get(handlers::get_recurring_invoice)
                .patch(handlers::update_recurring_invoice)
                .delete(handlers::delete_recurring_invoice),
        )
}
