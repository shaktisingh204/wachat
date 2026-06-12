//! Mountable routers for the §1.6 Invoice endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/invoices`. Behaviour is unchanged (including the public
//!   Stripe checkout/webhook routes).
//! - [`project_router`] — the SabCRM Finance suite surface, scoped by a
//!   required `projectId`. Mount under `/v1/sabcrm/finance/invoices`.
//!   CRUD only — the Stripe routes stay on the legacy mount.
//!
//! ```ignore
//! use crm_invoices;
//! .nest("/v1/crm/invoices", crm_invoices::router::<AppState>())
//! .nest("/v1/sabcrm/finance/invoices", crm_invoices::project_router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{Extension, Router, extract::FromRef, routing::get, routing::post};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::{handlers, stripe};

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
            get(handlers::list_invoices).post(handlers::create_invoice),
        )
        .route(
            "/{invoiceId}",
            get(handlers::get_invoice)
                .patch(handlers::update_invoice)
                .delete(handlers::delete_invoice),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/invoices`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes()
        .route(
            "/public/{hash}/stripe-checkout",
            post(stripe::start_stripe_checkout),
        )
        .route("/stripe-webhook", post(stripe::stripe_webhook))
        .layer(Extension(ScopeMode::User))
}

/// SabCRM Finance `projectId`-scoped router — mount under
/// `/v1/sabcrm/finance/invoices`. Same handlers, same `crm_invoices`
/// collection; every request must carry `projectId` (query for
/// `GET`/`PATCH`/`DELETE`, body for `POST`) or it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
