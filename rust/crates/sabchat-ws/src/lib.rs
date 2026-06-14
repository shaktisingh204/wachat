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
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    Router,
    extract::{FromRef, Request},
    http::{HeaderValue, header::AUTHORIZATION},
    middleware::{Next, from_fn},
    response::Response,
    routing::get,
};
use fred::clients::Client;
use fred::interfaces::{ClientLike, EventInterface, PubsubInterface};
use fred::types::config::Config as FredConfig;
use sabnode_auth::AuthConfig;
use serde::Serialize;
use tracing::warn;

pub use state::SabChatWsState;

use sabnode_db::RedisHandle;
use serde::Deserialize;

/// Redis pub/sub channel the cross-process fan-out runs over.
const WS_REDIS_CHANNEL: &str = "sabchat:ws";

/// Wire envelope for cross-process events. Wrapping (rather than adding a
/// field to [`Event`]) keeps every `Event { … }` construction site untouched.
/// `origin` is the publishing process's id so the subscriber loop can drop its
/// own loopback and avoid double-delivering local events.
#[derive(Serialize, Deserialize)]
struct RedisEnvelope {
    origin: String,
    event: Event,
}

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
    redis: RedisHandle,
    /// This process's unique id — tags outgoing Redis events so we can drop
    /// our own loopback on the subscriber side.
    origin: String,
}

impl WsHub {
    /// Build a fresh hub with a capacity-1024 broadcast channel, and spawn a
    /// background task to listen to the Redis pubsub channel. Call
    /// once at process startup and stash the result in the orchestrator
    /// state — every other crate clones from there.
    pub fn new(redis: RedisHandle) -> Self {
        let (tx, _rx) = tokio::sync::broadcast::channel(HUB_CAPACITY);

        // Per-process origin id (pid + start nanos) for loopback suppression.
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let origin = format!("{}-{}", std::process::id(), nanos);

        // Cross-process fan-out: a DEDICATED fred client (a subscribed
        // connection blocks other commands, so we cannot reuse `redis.client`)
        // relays `sabchat:ws` messages into the local broadcast channel. We
        // drop our own loopback by `origin`. If Redis is unavailable this task
        // just exits — single-instance in-process delivery still works.
        let sub_origin = origin.clone();
        let sub_tx = tx.clone();
        tokio::spawn(async move {
            let url = std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string());
            let config = match FredConfig::from_url(&url) {
                Ok(c) => c,
                Err(err) => {
                    warn!(%err, "sabchat-ws: invalid REDIS_URL — cross-process fan-out disabled");
                    return;
                }
            };
            let client = Client::new(config, None, None, None);
            if let Err(err) = client.init().await {
                warn!(%err, "sabchat-ws: redis init failed — cross-process fan-out disabled");
                return;
            }
            let mut messages = client.message_rx();
            if let Err(err) = client.subscribe(WS_REDIS_CHANNEL).await {
                warn!(%err, "sabchat-ws: redis subscribe failed");
                return;
            }
            loop {
                match messages.recv().await {
                    Ok(msg) => {
                        let Ok(json) = msg.value.convert::<String>() else {
                            continue;
                        };
                        let Ok(envelope) = serde_json::from_str::<RedisEnvelope>(&json) else {
                            continue;
                        };
                        if envelope.origin != sub_origin {
                            let _ = sub_tx.send(envelope.event);
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                }
            }
        });

        Self { tx, redis, origin }
    }

    /// Publish an [`Event`] to every connected socket across all processes.
    /// It publishes the event to Redis, which will fan it out to all nodes.
    ///
    /// Per-socket filtering by `tenant_id` happens on the receive side
    /// inside [`handlers::ws_upgrade`].
    pub fn publish(&self, ev: Event) {
        // Immediate in-process delivery — works even when Redis is down.
        let _ = self.tx.send(ev.clone());

        // Best-effort cross-process fan-out. Publishing uses the SHARED client
        // (a normal connection — only the subscriber side is in pubsub mode).
        // Tagged with our origin so our own subscriber drops the loopback.
        let client = self.redis.client.clone();
        let envelope = RedisEnvelope {
            origin: self.origin.clone(),
            event: ev,
        };
        tokio::spawn(async move {
            if let Ok(json) = serde_json::to_string(&envelope) {
                let _: std::result::Result<i64, _> =
                    client.publish(WS_REDIS_CHANNEL, json).await;
            }
        });
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
