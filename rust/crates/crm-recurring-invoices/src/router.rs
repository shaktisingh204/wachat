//! Mountable router. Mount under `/v1/crm/recurring-invoices`.

use std::sync::Arc;

use axum::{Extension, Router, extract::FromRef, routing::get};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// The shared CRUD route table (no scope attached yet).
fn crud_routes<S>() -> Router<S>
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

/// Legacy `userId`-scoped router — behaviour unchanged; mount under the
/// existing `/v1/crm/*` path.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Finance `projectId`-scoped router — mount under
/// `/v1/sabcrm/finance/*`. Same handlers, same collection; every request
/// must carry `projectId` (query for `GET`/`PATCH`/`DELETE`, body for
/// `POST`) or it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
