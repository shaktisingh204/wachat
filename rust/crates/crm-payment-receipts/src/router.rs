//! Mountable routers for the §1.7 PaymentReceipt endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/payment-receipts`. Behaviour is unchanged.
//! - [`project_router`] — the SabCRM Finance suite surface, scoped by a
//!   required `projectId`. Mount under
//!   `/v1/sabcrm/finance/payment-receipts`.
//!
//! ```ignore
//! use crm_payment_receipts;
//! .nest("/v1/crm/payment-receipts", crm_payment_receipts::router::<AppState>())
//! .nest("/v1/sabcrm/finance/payment-receipts", crm_payment_receipts::project_router::<AppState>())
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
/// GET    /                  — list_payment_receipts
/// POST   /                  — create_payment_receipt
/// GET    /{receiptId}       — get_payment_receipt
/// PATCH  /{receiptId}       — update_payment_receipt
/// DELETE /{receiptId}       — delete_payment_receipt
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
            get(handlers::list_payment_receipts).post(handlers::create_payment_receipt),
        )
        .route(
            "/{receiptId}",
            get(handlers::get_payment_receipt)
                .patch(handlers::update_payment_receipt)
                .delete(handlers::delete_payment_receipt),
        )
}

/// Legacy `userId`-scoped router — mount under
/// `/v1/crm/payment-receipts`.
///
/// `S` is the caller's outer application state. Handlers need a
/// [`MongoHandle`] (data access) and `Arc<AuthConfig>` (the JWT
/// verifier the `AuthUser` extractor reads). Both are pulled via
/// [`FromRef`] so this crate stays decoupled from the orchestrator's
/// concrete `AppState`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Finance `projectId`-scoped router — mount under
/// `/v1/sabcrm/finance/payment-receipts`. Same handlers, same
/// `crm_payment_receipts` collection; every request must carry
/// `projectId` (query for `GET`/`PATCH`/`DELETE`, body for `POST`) or
/// it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
