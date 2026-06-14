//! # sabchat-ws
//!
//! Phase — axum router that owns the SabChat **realtime websocket**
//! endpoint. Mounted under `/v1/sabchat/ws` from the orchestrating `api`
//! crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/ws", sabchat_ws::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! A single `GET /` route that upgrades to a WebSocket. After upgrade
//! the connection multiplexes per-tenant events fanned out from an
//! in-process [`WsHub`] (a [`tokio::sync::broadcast`] channel wrapped in
//! a `Clone`-cheap accessor). Sibling SabChat crates (`sabchat-messages`,
//! `sabchat-conversations`, ...) import [`WsHub`] from this crate and
//! call [`WsHub::publish`] to push events to every socket whose
//! [`AuthUser::tenant_id`](sabnode_auth::AuthUser) matches the event's
//! `tenant_id`.
//!
//! ## Event shape
//!
//! On the wire each event renders as:
//!
//! ```json
//! { "type": "message.created",       "payload": { ... } }
//! { "type": "conversation.updated",  "payload": { ... } }
//! { "type": "conversation.created",  "payload": { ... } }
//! { "type": "presence",              "payload": { "agentId": "...", "status": "online|away|busy|offline" } }
//! { "type": "typing",                "payload": { "conversationId": "...", "actor": "agent|visitor", "actorId": "..." } }
//! ```
//!
//! [`Event::tenant_id`] is stripped before serialization (it's only
//! used in-process for fan-out filtering — leaking it on the wire would
//! be redundant since every socket already knows its own tenant).
//!
//! ## Inbound client frames
//!
//! Agents can send the following JSON frames over their socket; each is
//! handled in [`handlers::ws_upgrade`]:
//!
//! - `{ "type": "ping" }` — server replies with `{ "type": "pong" }`.
//! - `{ "type": "presence", "status": "online|away|busy" }` —
//!   server broadcasts a `presence` event tagged with the calling
//!   agent's id back to the whole tenant.
//! - `{ "type": "typing", "conversationId": "..." }` — server
//!   broadcasts a `typing` event tagged `actor = "agent"`.
//!
//! Any other / malformed inbound frame is logged at `warn!` and dropped
//! — sockets are intentionally lenient to keep the surface forward-
//! compatible.
//!
//! ## Auth
//!
//! The upgrade route requires the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor. If the JWT is
//! missing or invalid axum rejects the upgrade with `401` via
//! `AuthError`'s `IntoResponse` impl — no special-casing needed here.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handler
//! needs:
//!
//! - a [`SabChatWsState`] bundle (just the hub), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::{FromRef, Request},
    http::{HeaderValue, header::AUTHORIZATION},
    middleware::{Next, from_fn},
    response::Response,
    routing::get,
};
use sabnode_auth::AuthConfig;
use serde::Serialize;

pub use state::SabChatWsState;

use sabnode_db::RedisHandle;
use serde::Deserialize;

// ---------------------------------------------------------------------------
// Public broadcast API
// ---------------------------------------------------------------------------

/// Per-process broadcast capacity. 1024 is large enough that a slow
/// consumer takes a noticeable amount of lag before it gets `Lagged`'d
/// by the channel, but small enough that we don't pin too much memory
/// per process. Lagged sockets are dropped — they can reconnect and
/// resync via REST.
const HUB_CAPACITY: usize = 1024;

/// In-process fan-out channel for SabChat realtime events.
///
/// All connected websockets share a single
/// [`tokio::sync::broadcast::Sender<Event>`]. Publishers (other SabChat
/// crates) call [`WsHub::publish`] which routes the message to Redis.
/// A background task listens to Redis and forwards events to the local
/// broadcast channel.
///
/// Cloning is cheap — `broadcast::Sender` and `RedisHandle` are `Arc`-backed.
#[derive(Clone)]
pub struct WsHub {
    tx: tokio::sync::broadcast::Sender<Event>,
    #[allow(dead_code)]
    redis: RedisHandle,
}

impl WsHub {
    /// Build a fresh hub with a capacity-1024 broadcast channel, and spawn a
    /// background task to listen to the Redis pubsub channel. Call
    /// once at process startup and stash the result in the orchestrator
    /// state — every other crate clones from there.
    pub fn new(redis: RedisHandle) -> Self {
        let (tx, _rx) = tokio::sync::broadcast::channel(HUB_CAPACITY);

        // TODO(sabchat-ws): cross-process pubsub fan-out via Redis.
        //
        // The previous implementation called `client.on_message()` +
        // `client.subscribe()` to relay Redis pubsub messages into the
        // local `broadcast` channel, but fred 10 changed the receiver
        // shape and the calls no longer compile. In-process broadcast
        // still works fine (single-instance deploys), so we ship that
        // and leave the cross-process bridge as a follow-up. When this
        // lands, subscribe to `sabchat:ws`, decode each payload to
        // `Event`, and `tx.send(ev)`.

        Self { tx, redis }
    }

    /// Publish an [`Event`] to every connected socket across all processes.
    /// It publishes the event to Redis, which will fan it out to all nodes.
    ///
    /// Per-socket filtering by `tenant_id` happens on the receive side
    /// inside [`handlers::ws_upgrade`].
    pub fn publish(&self, ev: Event) {
        // In-process fan-out only until the cross-process Redis bridge is
        // wired back up (see TODO in `WsHub::new`). `redis` is held on the
        // struct so the API stays stable for callers; once the bridge is
        // back, route the event through `redis.client.publish(...)` here.
        let _ = self.tx.send(ev);
    }

    /// Subscribe a new receiver to the broadcast channel. Used by the WS
    /// upgrade handler and by sibling crates that fan events out over other
    /// transports (e.g. the widget SSE stream).
    pub fn subscribe(&self) -> tokio::sync::broadcast::Receiver<Event> {
        self.tx.subscribe()
    }
}

/// One realtime event fanned out by [`WsHub`].
///
/// `tenant_id` is serialized to Redis for multi-node broadcast, but stripped
/// before being sent to the browser in `handlers::ws_upgrade`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Event {
    /// Tenant the event belongs to. Sockets only forward events whose
    /// `tenant_id` matches their authenticated agent's tenant.
    pub tenant_id: bson::oid::ObjectId,

    /// Event kind — `"message.created"`, `"conversation.updated"`,
    /// `"conversation.created"`, `"presence"`, `"typing"`.
    #[serde(rename = "type")]
    pub kind: String,

    /// Free-form payload. Each `kind` documents its own shape (see the
    /// crate-level docs above).
    pub payload: serde_json::Value,
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/// Build the SabChat websocket router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/ws`):
///
/// ```text
/// GET   /          — ws_upgrade
/// ```
///
/// `S` is the caller's outer application state. The handler needs a
/// [`SabChatWsState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router stays decoupled from any
/// concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatWsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::ws_upgrade))
        // Browsers can't set request headers on a `new WebSocket()`
        // handshake, so the agent client passes its short-lived JWT as a
        // `?token=` query param. This layer copies it into the
        // `Authorization` header BEFORE the `AuthUser` extractor runs, so
        // `ws_upgrade` stays a normal authenticated route.
        .layer(from_fn(query_token_to_auth_header))
}

/// Promote a `?token=` query parameter into an `Authorization: Bearer …`
/// header when none is already present. Server-to-server callers that send
/// the header directly are left untouched.
async fn query_token_to_auth_header(mut req: Request, next: Next) -> Response {
    if !req.headers().contains_key(AUTHORIZATION) {
        if let Some(token) = req.uri().query().and_then(token_from_query) {
            if let Ok(val) = HeaderValue::from_str(&format!("Bearer {token}")) {
                req.headers_mut().insert(AUTHORIZATION, val);
            }
        }
    }
    next.run(req).await
}

/// Extract the `token` value from a raw query string. JWTs use only the
/// URL-safe alphabet `[A-Za-z0-9-_.]`, so no percent-decoding is required.
fn token_from_query(query: &str) -> Option<String> {
    query.split('&').find_map(|pair| {
        let mut it = pair.splitn(2, '=');
        match (it.next(), it.next()) {
            (Some("token"), Some(v)) if !v.is_empty() => Some(v.to_owned()),
            _ => None,
        }
    })
}
