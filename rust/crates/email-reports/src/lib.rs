//! # email-reports
//!
//! Pre-aggregated reports CRUD over `email_reports_cache` + a public
//! [`aggregate::aggregate_for_tenant`] function the
//! `email-reports-worker` binary calls on a tokio interval to keep
//! the cache fresh.
//!
//! ## Surface
//!
//! ```text
//! GET  /campaigns/{id}            — campaign report (cached, live fallback)
//! GET  /journeys/{id}             — journey report (cached, live fallback)
//! GET  /account                   — tenant rollup
//! POST /compare                   — side-by-side metrics
//! GET  /revenue                   — CRM-orders join
//! POST /export                    — CSV (PDF deferred)
//! ```
//!
//! Mount under `/v1/email/reports`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub mod aggregate;
pub mod dto;
pub mod handlers;
pub mod state;

pub use aggregate::aggregate_for_tenant;
pub use dto::Bucket;
pub use state::EmailReportsState;

/// Build the email-reports router. Routes relative — caller nests
/// under `/v1/email/reports`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    EmailReportsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/campaigns/{id}", get(handlers::campaign_report))
        .route("/journeys/{id}", get(handlers::journey_report))
        .route("/account", get(handlers::account_report))
        .route("/compare", post(handlers::compare))
        .route("/revenue", get(handlers::revenue))
        .route("/export", post(handlers::export))
}
