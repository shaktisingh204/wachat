//! # email-webhooks
//!
//! Outbound webhook control plane for the SabNode email-suite. Owns the
//! `email_webhook_configs` collection and exposes a public
//! [`deliver::deliver`] helper that other email crates call when they
//! record an `email_events` row that subscribers care about.
//!
//! ## Routes
//!
//! ```text
//! GET    /             — list configs
//! POST   /             — create (events, url; secret minted server-side)
//! PATCH  /{id}         — update url / events / active
//! DELETE /{id}         — delete
//! POST   /{id}/test    — fire a synthetic test payload
//! ```
//!
//! ## Signature
//!
//! Every delivery includes an `X-SabNode-Signature` header of the form
//! `t=<unix>,v1=<hex>`, where `<hex>` is `HMAC-SHA256(secret, "<t>.<body>")`.
//! Subscribers re-derive the value over the raw body and compare in
//! constant time to verify provenance.

pub mod deliver;
pub mod dto;
pub mod handlers;
pub mod state;

pub use deliver::deliver;
pub use state::EmailWebhooksState;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

/// Build the email-webhooks router. Caller nests under `/v1/email/webhooks`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    EmailWebhooksState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_configs).post(handlers::create_config),
        )
        .route(
            "/{id}",
            axum::routing::patch(handlers::update_config).delete(handlers::delete_config),
        )
        .route("/{id}/test", post(handlers::test_config))
}
