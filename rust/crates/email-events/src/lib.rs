//! # email-events
//!
//! Event ingest, tracking, and outbound-fanout for the SabNode email
//! suite. Mounts under `/v1/email/events`.
//!
//! ## Surface
//!
//! ```text
//! POST /providers/sendgrid/{token}     — Sendgrid event array
//! POST /providers/mailgun/{token}      — Mailgun form-encoded event
//! POST /providers/ses/{token}          — SES → SNS notification JSON
//! POST /providers/postmark/{token}     — Postmark batch JSON
//! POST /providers/brevo/{token}        — Brevo single-event JSON
//!
//! GET  /track/open/{token}             — 1x1 PNG, records `open`     (PUBLIC)
//! GET  /track/click/{token}            — 302 redirect, records `click` (PUBLIC)
//!
//! GET  /                               — list events (JWT)
//! ```
//!
//! The `/providers/*` and `/track/*` sub-trees are **public** — they
//! cannot require a JWT because providers and end-recipients hit them
//! directly. Provenance is established differently:
//!
//! * **Provider webhooks** verify the per-tenant token in the URL path
//!   against `email_settings.providerSecrets.<provider>`.
//! * **Tracking pixels / clicks** verify a signed token (HMAC-SHA256
//!   over `{campaignId, subscriberId, tenantId}` plus, for clicks, the
//!   target URL) using the `EMAIL_TRACKING_SECRET` env var.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. It pulls
//! [`EmailEventsState`] and `Arc<sabnode_auth::AuthConfig>` via
//! [`FromRef`].

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub mod dto;
pub mod fanout;
pub mod handlers;
pub mod state;
pub mod tracking;

pub use state::EmailEventsState;

/// Build the email-events router.
///
/// Routes (relative — caller nests under `/v1/email/events`):
///
/// ```text
/// POST /providers/sendgrid/{token}
/// POST /providers/mailgun/{token}
/// POST /providers/ses/{token}
/// POST /providers/postmark/{token}
/// POST /providers/brevo/{token}
/// GET  /track/open/{token}
/// GET  /track/click/{token}
/// GET  /
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    EmailEventsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/providers/sendgrid/{token}",
            post(handlers::ingest_sendgrid),
        )
        .route("/providers/mailgun/{token}", post(handlers::ingest_mailgun))
        .route("/providers/ses/{token}", post(handlers::ingest_ses))
        .route(
            "/providers/postmark/{token}",
            post(handlers::ingest_postmark),
        )
        .route("/providers/brevo/{token}", post(handlers::ingest_brevo))
        .route("/track/open/{token}", get(handlers::track_open))
        .route("/track/click/{token}", get(handlers::track_click))
        .route("/", get(handlers::list_events))
}
