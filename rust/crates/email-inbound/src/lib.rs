//! # email-inbound
//!
//! Axum router that ingests inbound email from upstream providers and
//! threads the result into the SabNode inbox collections
//! (`email_threads` + `email_messages`).
//!
//! ## Routes
//!
//! Mounted under `/v1/email/inbound` by the `api` crate:
//!
//! ```text
//! POST /mailgun          — Mailgun "Routes / Store and Notify" webhook
//!                          (form-encoded; pre-parsed fields)
//! POST /ses              — SES → SNS notification (JSON envelope wrapping raw MIME)
//! POST /raw              — Raw RFC-822 MIME body, for SMTP relay scenarios
//! ```
//!
//! Each accepts either `/{provider}/{token}` (preferred — opaque path
//! token) or `/{provider}?token=...` (fallback for providers that
//! mangle path segments). The token is matched against
//! `email_settings.inboundSecret` to resolve the owning tenant.
//!
//! ## Threading rule
//!
//! 1. If the message carries `In-Reply-To` or any `References` header
//!    that already exists as `email_messages.messageId`, attach to that
//!    message's thread.
//! 2. Otherwise look for an existing thread with the same
//!    `(userId, normalizedSubject)` (subject stripped of `Re:` / `Fwd:`
//!    prefixes) and merge if found.
//! 3. Else create a fresh thread.
//!
//! ## Auth
//!
//! No JWT. Tenancy is established entirely by the inbound secret token.
//! A wrong / missing token surfaces as `404` (we deliberately don't
//! distinguish missing-secret from wrong-secret to avoid revealing which
//! tokens map to active tenants).

use axum::{Router, extract::FromRef, routing::post};

pub mod dto;
pub mod handlers;
pub mod state;

pub use state::EmailInboundState;

/// Build the email-inbound router.
///
/// Routes (mounted relative — caller nests under `/v1/email/inbound`):
///
/// ```text
/// POST /mailgun                  — accepts ?token= or form `token`
/// POST /mailgun/{token}
/// POST /ses                      — accepts ?token=
/// POST /ses/{token}
/// POST /raw                      — accepts ?token=
/// POST /raw/{token}
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    EmailInboundState: FromRef<S>,
{
    Router::new()
        .route("/mailgun", post(handlers::ingest_mailgun_noid))
        .route("/mailgun/{token}", post(handlers::ingest_mailgun))
        .route("/ses", post(handlers::ingest_ses_noid))
        .route("/ses/{token}", post(handlers::ingest_ses))
        .route("/raw", post(handlers::ingest_raw_noid))
        .route("/raw/{token}", post(handlers::ingest_raw))
}
