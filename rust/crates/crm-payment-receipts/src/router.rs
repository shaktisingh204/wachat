//! Mountable router for the §1.7 PaymentReceipt endpoints.
//!
//! Mount under `/v1/crm/payment-receipts` from the host `api` crate:
//!
//! ```ignore
//! use crm_payment_receipts;
//! .nest("/v1/crm/payment-receipts", crm_payment_receipts::router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/crm/payment-receipts`):
///
/// ```text
/// GET    /                  — list_payment_receipts
/// POST   /                  — create_payment_receipt
/// GET    /{receiptId}       — get_payment_receipt
/// PATCH  /{receiptId}       — update_payment_receipt
/// DELETE /{receiptId}       — delete_payment_receipt
/// ```
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
