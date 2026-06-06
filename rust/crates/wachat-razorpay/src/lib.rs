//! # wachat-razorpay
//!
//! Axum router backing the `/wachat/integrations/razorpay` page: per-project
//! Razorpay credentials plus read/create access to a project's Razorpay
//! payment activity. Mounted under `/v1/wachat/razorpay`:
//!
//! ```ignore
//! .nest("/v1/wachat/razorpay", wachat_razorpay::router::<AppState>())
//! ```
//!
//! ## Surface
//!
//! ```text
//! GET  /projects/{id}/settings           — read razorpaySettings (keySecret masked)
//! PUT  /projects/{id}/settings           — upsert { keyId, keySecret }
//! GET  /projects/{id}/logs/transactions  — Razorpay payments.all
//! GET  /projects/{id}/logs/payment-links — Razorpay paymentLink.all
//! POST /projects/{id}/payment-links      — create a Razorpay payment link
//! ```
//!
//! ## Tenancy
//!
//! Every endpoint is project-scoped and guarded with the owner-or-agent
//! membership check (mirrors `wachat-contacts`): a project is only visible if
//! `userId == caller` OR `agents.userId == caller`. Credentials live in the
//! `projects.razorpaySettings` sub-doc (the real, existing collection — no
//! second store).
//!
//! ## External seam
//!
//! All HTTP to `api.razorpay.com` lives in [`razorpay_client`]. The settings
//! GET/PUT never touch the network; the log + create endpoints require
//! configured creds (else `ApiError::BadRequest("Razorpay not configured")`)
//! and translate any upstream failure into `ApiError::Internal` — the module
//! never panics and never unwraps a network result.

pub mod dto;
pub mod handlers;
pub mod razorpay_client;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatRazorpayState;

/// Build the razorpay router (caller nests under `/v1/wachat/razorpay`).
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatRazorpayState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/projects/{id}/settings",
            get(handlers::get_settings).put(handlers::put_settings),
        )
        .route(
            "/projects/{id}/logs/transactions",
            get(handlers::list_transactions),
        )
        .route(
            "/projects/{id}/logs/payment-links",
            get(handlers::list_payment_links),
        )
        .route(
            "/projects/{id}/payment-links",
            post(handlers::create_payment_link),
        )
}
