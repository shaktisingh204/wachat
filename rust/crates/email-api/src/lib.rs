//! # email-api
//!
//! Tenant API key management for the SabNode email-suite. Mirrors the
//! shape of [`developer_personal_tokens`] but writes to a separate
//! `email_api_keys` collection so the email subsystem can rotate /
//! revoke independently from the global developer surface.
//!
//! ## Key format
//!
//! Plaintext keys are emitted as `sn_email_<32 hex chars>`. The full
//! string is returned exactly once on `POST /` and never persisted —
//! only an argon2id hash of the suffix is stored. The `prefix` shown in
//! the list is the first 12 chars (the `sn_email_` prefix plus the
//! first 3 chars of the suffix) so the UI can render a recognisable
//! handle without leaking entropy.
//!
//! ## Routes
//!
//! ```text
//! GET    /             — list keys for the tenant
//! POST   /             — mint a new key
//! PATCH  /{id}         — rename / re-scope
//! DELETE /{id}         — revoke
//! ```

pub mod dto;
pub mod handlers;
pub mod state;
pub mod verify;

pub use state::EmailApiState;
pub use verify::verify_api_key;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;

/// Build the email-api router. Caller nests under `/v1/email/api-keys`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    EmailApiState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_keys).post(handlers::create_key))
        .route(
            "/{id}",
            axum::routing::patch(handlers::update_key).delete(handlers::revoke_key),
        )
}
