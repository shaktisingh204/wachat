//! Mountable router for the §1.6 Invoice endpoints.
//!
//! Mount under `/v1/crm/invoices` from the host `api` crate:
//!
//! ```ignore
//! use crm_invoices;
//! .nest("/v1/crm/invoices", crm_invoices::router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::get,
    routing::post,
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::{handlers, stripe};

pub fn router<S>() -> Router<S>
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
        .route(
            "/public/:hash/stripe-checkout",
            post(stripe::start_stripe_checkout),
        )
        .route(
            "/stripe-webhook",
            post(stripe::stripe_webhook),
        )
}
