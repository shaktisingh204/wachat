//! # wachat-webhook
//!
//! HTTP receiver crate for Meta WhatsApp webhooks.
//!
//! ## Routes
//!
//! * `GET  /v1/wachat/webhook/meta` — Meta verification handshake (returns
//!   `hub.challenge` plain-text when `hub.mode == "subscribe"` and
//!   `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN`).
//! * `POST /v1/wachat/webhook/meta` — Signature-verified payload receiver.
//!   Parses the body, looks up the `Project` by Meta WABA id, and dispatches
//!   each `change.field` to its dedicated processor crate.
//!
//! ## Architecture
//!
//! This crate is intentionally a **thin dispatcher**. Every real concern —
//! status updates, inbound message persistence, contact upsert, conversation
//! window tracking, account/template event handling, DLQ writes — lives in
//! its own sibling crate so the receiver can stay small, fast, and unit
//! testable in isolation:
//!
//! * [`wachat_webhook_verify`] — HMAC-SHA256 signature check (extractor).
//! * [`wachat_webhook_status`] — `value.statuses[]` → `MessageLog` updates.
//! * [`wachat_webhook_inbound`] — `value.messages[]` → `MessageLog` insert.
//! * [`wachat_webhook_contacts`] — sender profile upsert from inbound.
//! * [`wachat_webhook_conversations`] — Meta 24h conversation window tracking.
//! * [`wachat_webhook_account`] — `account_*`, `phone_number_*`, `security`,
//!   `business_capability_update` events.
//! * [`wachat_webhook_template_events`] — `message_template_*_update` events.
//! * [`wachat_webhook_dlq`] — failure sink (BullMQ DLQ producer).
//!
//! ## Meta-correctness invariants
//!
//! * Always return `200 OK` once signature + parse succeed. Meta retries 5xx
//!   aggressively (and exponentially) — propagating an internal failure back
//!   to Meta would amplify the outage.
//! * Processor errors are caught at the dispatch boundary and routed to DLQ
//!   with the original raw payload, never re-thrown.
//! * Signature failure → `401 Unauthorized`. Body parse failure →
//!   `400 Bad Request`. Both are safe — Meta logs them but does not retry.
//! * Causality is preserved within a single `change.value`:
//!   `inbound` runs before `contacts.upsert_from_inbound` and
//!   `conversations.on_inbound`; `status` runs before
//!   `conversations.on_status`. Across `entry[]`/`changes[]` we fan out
//!   concurrently via `futures::join_all`.
//!
//! ## Wiring
//!
//! ```ignore
//! use std::sync::Arc;
//! use axum::{Router, extract::FromRef};
//! use wachat_webhook::{router, WebhookState};
//! use wachat_webhook_verify::WebhookVerifier;
//!
//! #[derive(Clone)]
//! struct AppState {
//!     webhook: WebhookState,
//!     verifier: Arc<WebhookVerifier>,
//! }
//! impl FromRef<AppState> for WebhookState   { fn from_ref(s: &AppState) -> Self { s.webhook.clone() } }
//! impl FromRef<AppState> for Arc<WebhookVerifier> {
//!     fn from_ref(s: &AppState) -> Self { s.verifier.clone() }
//! }
//!
//! let app: Router = Router::new().merge(router::<AppState>()).with_state(state);
//! ```

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};

use wachat_webhook_verify::WebhookVerifier;

pub mod dispatcher;
pub mod dto;
pub mod error;
pub mod handlers;
pub mod state;

pub use dto::VerifyQuery;
pub use error::WebhookError;
pub use state::WebhookState;

/// Path prefix for all wachat webhook routes. Kept here so the binary that
/// mounts the router and any reverse-proxy/openapi tooling see the same string.
pub const WEBHOOK_PATH: &str = "/v1/wachat/webhook/meta";

/// Build the wachat webhook router.
///
/// The returned `Router<S>` is generic over the application's outer state
/// type. `S` must expose both [`WebhookState`] (for the dispatcher) and
/// `Arc<WebhookVerifier>` (for the signature extractor) via [`FromRef`].
///
/// Both routes share the same path; axum dispatches by HTTP method.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WebhookState: FromRef<S>,
    Arc<WebhookVerifier>: FromRef<S>,
{
    Router::new()
        .route(WEBHOOK_PATH, get(handlers::verify_challenge))
        .route(WEBHOOK_PATH, post(handlers::receive))
}
