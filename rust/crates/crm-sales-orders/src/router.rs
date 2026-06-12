//! Mountable routers for the §1.4 Sales Order endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/sales-orders`. Behaviour is unchanged.
//! - [`project_router`] — the SabCRM Finance suite surface, scoped by a
//!   required `projectId`. Mount under
//!   `/v1/sabcrm/finance/sales-orders`.
//!
//! ```ignore
//! use crm_sales_orders;
//! .nest("/v1/crm/sales-orders", crm_sales_orders::router::<AppState>())
//! .nest("/v1/sabcrm/finance/sales-orders", crm_sales_orders::project_router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{Extension, Router, extract::FromRef, routing::get};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// The shared CRUD route table (no scope attached yet).
///
/// ```text
/// GET    /                  — list_sales_orders
/// POST   /                  — create_sales_order
/// GET    /{soId}            — get_sales_order
/// PATCH  /{soId}            — update_sales_order
/// DELETE /{soId}            — delete_sales_order
/// ```
fn crud_routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_sales_orders).post(handlers::create_sales_order),
        )
        .route(
            "/{soId}",
            get(handlers::get_sales_order)
                .patch(handlers::update_sales_order)
                .delete(handlers::delete_sales_order),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/sales-orders`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Finance `projectId`-scoped router — mount under
/// `/v1/sabcrm/finance/sales-orders`. Same handlers, same
/// `crm_sales_orders` collection; every request must carry `projectId`
/// (query for `GET`/`PATCH`/`DELETE`, body for `POST`) or it is
/// rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
