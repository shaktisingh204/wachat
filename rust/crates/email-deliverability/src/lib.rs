//! # email-deliverability
//!
//! HTTP surface for the SabNode email deliverability tools — DNS record
//! checks, DKIM keypair generation + rotation, sender warmup schedules,
//! inbox-placement test scaffolding, and the rollup deliverability score.
//!
//! Routes are written **relative**. The orchestrating `api` crate nests
//! the result under `/v1/email/deliverability`, giving final URLs like
//! `/v1/email/deliverability/domains/example.com/check`.
//!
//! ## Mongo collections
//!
//! - `email_dns_snapshots`  — historical DNS check results (per domain).
//! - `email_settings`       — per-tenant DKIM key material under `dkim.*`.
//! - `email_warmup_runs`    — warmup schedules with per-day caps.
//! - `email_placement_tests`— placement-test intents (seedlist later).
//! - `email_events`         — read-only here, used by the score rollup.
//!
//! ## Tenancy
//!
//! Every authenticated handler scopes Mongo queries by
//! `user_id = AuthUser.tenant_id`. There are no cross-tenant endpoints
//! in this crate.

pub mod dkim;
pub mod dns;
pub mod dto;
pub mod handlers;
pub mod state;

pub use state::EmailDeliverabilityState;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, patch, post},
};
use sabnode_auth::AuthConfig;

/// Build the email-deliverability router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/email/deliverability`):
///
/// ```text
/// GET    /domains                              — list verified domains
/// POST   /domains/{domain}/check               — live DNS check + persist
/// POST   /domains/{domain}/dkim/generate       — generate new DKIM keypair
/// POST   /domains/{domain}/dkim/rotate         — promote pending → active
///
/// GET    /warmup                               — list active warmup runs
/// POST   /warmup                               — start a warmup
/// PATCH  /warmup/{id}                          — pause / resume / cancel
///
/// GET    /placement                            — last placement test result
/// POST   /placement/run                        — record placement intent
///
/// GET    /score                                — current rollup score
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    EmailDeliverabilityState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/domains", get(handlers::list_domains))
        .route("/domains/{domain}/check", post(handlers::check_domain))
        .route(
            "/domains/{domain}/dkim/generate",
            post(handlers::dkim_generate),
        )
        .route(
            "/domains/{domain}/dkim/rotate",
            post(handlers::dkim_rotate),
        )
        .route(
            "/warmup",
            get(handlers::list_warmup).post(handlers::start_warmup),
        )
        .route("/warmup/{id}", patch(handlers::update_warmup))
        .route("/placement", get(handlers::get_placement))
        .route("/placement/run", post(handlers::run_placement))
        .route("/score", get(handlers::get_score))
}
