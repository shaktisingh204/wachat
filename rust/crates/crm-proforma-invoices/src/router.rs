//! Mountable routers for the Proforma Invoice endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/proforma-invoices`. Behaviour is unchanged.
//! - [`project_router`] — the SabCRM Finance suite surface, scoped by a
//!   required `projectId`. Mount under
//!   `/v1/sabcrm/finance/proforma-invoices`.

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
            get(handlers::list_proforma).post(handlers::create_proforma),
        )
        .route(
            "/{proformaId}",
            get(handlers::get_proforma)
                .patch(handlers::update_proforma)
                .delete(handlers::delete_proforma),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/proforma-invoices`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Finance `projectId`-scoped router — mount under
/// `/v1/sabcrm/finance/proforma-invoices`. Same handlers, same
/// `crm_proforma_invoices` collection; every request must carry
/// `projectId` (query for `GET`/`PATCH`/`DELETE`, body for `POST`) or it
/// is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
