//! # sabchat-webhooks
//!
//! Axum router for the SabChat **outbound webhooks** HTTP surface plus a
//! public [`enqueue`] helper that sibling crates call to record one
//! `pending` delivery row per matching endpoint when they emit an event.
//!
//! Mounted under `/v1/sabchat/webhooks` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/webhooks", sabchat_webhooks::router::<AppState>())
//! ```
//!
//! ## What this crate owns
//!
//! 1. **Endpoint CRUD** — register, list, fetch, patch, delete the
//!    `sabchat_webhook_endpoints` documents that tell the worker where
//!    to POST and which `events` each subscriber cares about.
//! 2. **Synthetic test send** (`POST /endpoints/{id}/test`) — records one
//!    `webhook.test` delivery row so operators can verify a brand-new
//!    endpoint without waiting for a real event.
//! 3. **Delivery + DLQ read APIs** (`GET /deliveries`, `GET /dlq`) plus
//!    a retry handle (`POST /deliveries/{id}/retry`) that moves DLQ rows
//!    back into the active queue.
//! 4. **`enqueue(...)` helper** — the canonical event-emission path
//!    sibling crates call from inside their mutation handlers.
//!
//! ## Out of scope (intentional)
//!
//! * Actual outbound HTTP firing — a separate worker pulls
//!   `sabchat_webhook_deliveries` rows in `pending` status and POSTs
//!   them, computing `X-SabChat-Signature` with
//!   `hmac_sha256(secret, body)` on the way out. The signing primitive
//!   itself lives here (`handlers::sign_payload`, `pub(crate)`) so when
//!   the worker lands it can import the same function.
//! * Retry scheduler / DLQ mover — same worker.
//!
//! ## HTTP surface
//!
//! | Method | Path                              | Handler                          |
//! |--------|-----------------------------------|----------------------------------|
//! | POST   | `/endpoints`                      | [`handlers::create_endpoint`]    |
//! | GET    | `/endpoints`                      | [`handlers::list_endpoints`]     |
//! | GET    | `/endpoints/{id}`                 | [`handlers::get_endpoint`]       |
//! | PATCH  | `/endpoints/{id}`                 | [`handlers::update_endpoint`]    |
//! | DELETE | `/endpoints/{id}`                 | [`handlers::delete_endpoint`]    |
//! | POST   | `/endpoints/{id}/test`            | [`handlers::test_endpoint`]      |
//! | GET    | `/deliveries`                     | [`handlers::list_deliveries`]    |
//! | POST   | `/deliveries/{id}/retry`          | [`handlers::retry_delivery`]     |
//! | GET    | `/dlq`                            | [`handlers::list_dlq`]           |
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. Handlers
//! need a [`SabChatWebhooksState`] bundle and an
//! `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor reads). Both are
//! pulled via [`FromRef`](axum::extract::FromRef) so this crate stays
//! decoupled from the orchestrator's monolithic `AppState`.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, patch, post},
};
use bson::oid::ObjectId;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;

pub use state::SabChatWebhooksState;

// ---------------------------------------------------------------------------
// Collection names
// ---------------------------------------------------------------------------
//
// Exposed `pub(crate)` so handlers + `enqueue` agree on the names
// without duplicating string literals. Mirrors the `AUDIT_COLL` pattern
// used by `sabchat-audit`.

/// `sabchat_webhook_endpoints` — registered subscribers (one document
/// per tenant + URL).
pub(crate) const ENDPOINTS_COLL: &str = "sabchat_webhook_endpoints";

/// `sabchat_webhook_deliveries` — one row per (endpoint, event) pair
/// that the worker is responsible for POSTing.
pub(crate) const DELIVERIES_COLL: &str = "sabchat_webhook_deliveries";

/// `sabchat_webhook_dlq` — deliveries that exhausted their retry
/// budget. Operators can `POST /deliveries/{id}/retry` to move a row
/// from here back into the active queue.
pub(crate) const DLQ_COLL: &str = "sabchat_webhook_dlq";

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/// Build the SabChat outbound-webhooks router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/webhooks`):
///
/// ```text
/// POST   /endpoints                  — create_endpoint
/// GET    /endpoints                  — list_endpoints
/// GET    /endpoints/{id}             — get_endpoint
/// PATCH  /endpoints/{id}             — update_endpoint
/// DELETE /endpoints/{id}             — delete_endpoint
/// POST   /endpoints/{id}/test        — test_endpoint
/// GET    /deliveries                 — list_deliveries
/// POST   /deliveries/{id}/retry      — retry_delivery
/// GET    /dlq                        — list_dlq
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatWebhooksState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatWebhooksState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/endpoints",
            post(handlers::create_endpoint).get(handlers::list_endpoints),
        )
        .route("/endpoints/{id}", get(handlers::get_endpoint))
        .route("/endpoints/{id}", patch(handlers::update_endpoint))
        .route("/endpoints/{id}", delete(handlers::delete_endpoint))
        .route("/endpoints/{id}/test", post(handlers::test_endpoint))
        .route("/deliveries", get(handlers::list_deliveries))
        .route("/deliveries/{id}/retry", post(handlers::retry_delivery))
        .route("/dlq", get(handlers::list_dlq))
}

// ---------------------------------------------------------------------------
// Public enqueue helper
// ---------------------------------------------------------------------------

/// Record one `pending` delivery row per active endpoint subscribed to
/// `event_kind` for `tenant_id`. Returns the number of rows written.
///
/// This is the **canonical** event-emission path for sibling crates.
/// Call it from inside the mutation handler that produced the event,
/// right after the underlying state change has been persisted:
///
/// ```ignore
/// use sabchat_webhooks::enqueue;
///
/// // inside a sabchat-messages handler, after the insert succeeds:
/// let _ = enqueue(&mongo, tenant_oid, "message.created", payload).await?;
/// ```
///
/// The actual outbound HTTP POST + retry / DLQ movement happens in a
/// separate worker that polls rows in `pending` status — this helper
/// only records, it never fires.
///
/// ## Matching rules
///
/// An endpoint is considered subscribed when its document satisfies the
/// filter `{ tenantId, active: true, events: <event_kind> }`. The
/// `events` array is matched on equality (Mongo's implicit `$in` over
/// an array field), so `["message.created", "conversation.updated"]`
/// matches an emit of either event.
///
/// ## Errors
///
/// Any Mongo error is wrapped in `anyhow::Error`. The caller is
/// expected to log + swallow (a webhook fan-out failure should not fail
/// the originating mutation), but we return the error rather than
/// hiding it so callers can decide.
pub async fn enqueue(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    event_kind: &str,
    payload: Value,
) -> anyhow::Result<u32> {
    handlers::enqueue_impl(mongo, tenant_id, event_kind, payload).await
}
