//! # sabchat-events
//!
//! Internal event bus + audit log for the SabChat module. Owns:
//!
//! 1. The **event taxonomy** — a closed set of `kind` string constants
//!    that every SabChat handler uses when it publishes a domain event.
//! 2. The [`EventBus`] — a `Clone`-cheap wrapper around a
//!    [`tokio::sync::broadcast::Sender<EventEnvelope>`] (capacity
//!    [`BUS_CAPACITY`]) that also persists every envelope into the
//!    `sabchat_events` Mongo collection on a best-effort basis.
//! 3. The HTTP **read** surface — agents query the persisted log via
//!    `GET /` / `GET /{id}` and re-broadcast a stored envelope via
//!    `POST /replay/{id}` (useful when re-attaching workers).
//!
//! Mounted under `/v1/sabchat/events` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/events", sabchat_events::router::<AppState>())
//! ```
//!
//! ## Why a bus + a log
//!
//! Domain events from SabChat handlers fan out to **four** independent
//! consumers — webhook subscribers, the WebSocket hub (`sabchat-ws`),
//! AI workers (sentiment / translate / copilot), and SabFlow triggers.
//! Wiring each handler crate to each consumer would create an N×M
//! coupling matrix. Instead, every handler calls
//! [`EventBus::publish`] once; subscribers run on the shared broadcast
//! channel via [`EventBus::subscribe`].
//!
//! The persisted log doubles the bus's value:
//!
//! * Workers that came up late can read the tail of the collection and
//!   replay missed events through [`EventBus::publish_existing`] /
//!   the `POST /replay/{id}` route.
//! * Operator tooling can answer "what happened to this conversation?"
//!   without instrumenting every handler.
//!
//! ## Event kinds
//!
//! The canonical set of `kind` strings is exposed as `pub const`
//! identifiers ([`KIND_CONVERSATION_CREATED`], …) so callers get
//! compile-time spelling guarantees. Sibling crates should reference
//! these constants rather than hard-coding the literals.
//!
//! | Domain         | Kinds                                                                                        |
//! |----------------|----------------------------------------------------------------------------------------------|
//! | Conversation   | `conversation.created`, `conversation.updated`, `conversation.resolved`, `conversation.reopened`, `conversation.assigned`, `conversation.snoozed` |
//! | Message        | `message.created`, `message.edited`, `message.deleted`                                       |
//! | Contact        | `contact.created`, `contact.updated`, `contact.merged`                                       |
//! | Inbox          | `inbox.created`, `inbox.updated`, `inbox.deleted`                                            |
//! | Other          | `csat.submitted`, `sla.breached`, `widget.event`                                             |
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatEventsState`] bundle (Mongo handle + [`EventBus`]), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use sabnode_auth::AuthConfig;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::warn;
use utoipa::ToSchema;

use sabnode_db::mongo::MongoHandle;

pub use state::SabChatEventsState;

// ---------------------------------------------------------------------------
// Collection + capacity constants
// ---------------------------------------------------------------------------

/// Mongo collection that backs the audit log. Append-only.
pub const EVENTS_COLL: &str = "sabchat_events";

/// In-process broadcast capacity. 4096 is large enough that a slow
/// subscriber takes a substantial lag before getting `Lagged` by the
/// channel, but small enough that we don't pin too much memory per
/// process. Lagged subscribers are intentionally dropped — they should
/// recover from the persisted log instead of trying to backfill the
/// channel.
pub const BUS_CAPACITY: usize = 4096;

// ---------------------------------------------------------------------------
// Event-source taxonomy
// ---------------------------------------------------------------------------

/// `source = "system"` — emitted by SabChat itself (handlers,
/// background workers, schedulers).
pub const SOURCE_SYSTEM: &str = "system";
/// `source = "webhook"` — emitted while processing an inbound channel
/// webhook (WhatsApp / Email / SMS / Instagram / …).
pub const SOURCE_WEBHOOK: &str = "webhook";
/// `source = "api"` — emitted in response to an authenticated agent /
/// admin API call.
pub const SOURCE_API: &str = "api";
/// `source = "agent"` — emitted by an AI agent (copilot, resolve-bot,
/// QA) on behalf of the tenant.
pub const SOURCE_AGENT: &str = "agent";

// ---------------------------------------------------------------------------
// Event-kind taxonomy
// ---------------------------------------------------------------------------

pub const KIND_CONVERSATION_CREATED: &str = "conversation.created";
pub const KIND_CONVERSATION_UPDATED: &str = "conversation.updated";
pub const KIND_CONVERSATION_RESOLVED: &str = "conversation.resolved";
pub const KIND_CONVERSATION_REOPENED: &str = "conversation.reopened";
pub const KIND_CONVERSATION_ASSIGNED: &str = "conversation.assigned";
pub const KIND_CONVERSATION_SNOOZED: &str = "conversation.snoozed";

pub const KIND_MESSAGE_CREATED: &str = "message.created";
pub const KIND_MESSAGE_EDITED: &str = "message.edited";
pub const KIND_MESSAGE_DELETED: &str = "message.deleted";

pub const KIND_CONTACT_CREATED: &str = "contact.created";
pub const KIND_CONTACT_UPDATED: &str = "contact.updated";
pub const KIND_CONTACT_MERGED: &str = "contact.merged";

pub const KIND_INBOX_CREATED: &str = "inbox.created";
pub const KIND_INBOX_UPDATED: &str = "inbox.updated";
pub const KIND_INBOX_DELETED: &str = "inbox.deleted";

pub const KIND_CSAT_SUBMITTED: &str = "csat.submitted";
pub const KIND_SLA_BREACHED: &str = "sla.breached";
pub const KIND_WIDGET_EVENT: &str = "widget.event";

/// Convenience array of every taxonomy kind. Useful for tests, OpenAPI
/// enum generation, and dashboards that want to render filter chips.
pub const ALL_KINDS: &[&str] = &[
    KIND_CONVERSATION_CREATED,
    KIND_CONVERSATION_UPDATED,
    KIND_CONVERSATION_RESOLVED,
    KIND_CONVERSATION_REOPENED,
    KIND_CONVERSATION_ASSIGNED,
    KIND_CONVERSATION_SNOOZED,
    KIND_MESSAGE_CREATED,
    KIND_MESSAGE_EDITED,
    KIND_MESSAGE_DELETED,
    KIND_CONTACT_CREATED,
    KIND_CONTACT_UPDATED,
    KIND_CONTACT_MERGED,
    KIND_INBOX_CREATED,
    KIND_INBOX_UPDATED,
    KIND_INBOX_DELETED,
    KIND_CSAT_SUBMITTED,
    KIND_SLA_BREACHED,
    KIND_WIDGET_EVENT,
];

// ---------------------------------------------------------------------------
// EventEnvelope
// ---------------------------------------------------------------------------

/// One envelope carried over the bus and stored in `sabchat_events`.
///
/// `tenant_id` is the routing key every subscriber filters on —
/// webhooks, the WebSocket hub, AI workers and SabFlow triggers all
/// scope their consumers to a single tenant. `kind` is one of the
/// [`ALL_KINDS`] constants; `payload` is a free-form JSON object whose
/// shape is documented per-kind by the publishing crate. `source` is
/// one of the `SOURCE_*` constants and lets subscribers distinguish
/// system-initiated mutations from webhook-driven ones (useful for
/// loop prevention).
#[derive(Clone, Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EventEnvelope {
    /// Tenant the event belongs to. Required on every envelope —
    /// subscribers only ever see events for the tenants they care about.
    #[schema(value_type = String)]
    pub tenant_id: ObjectId,

    /// One of the `KIND_*` constants from this crate. Free-form
    /// `String` on the wire so future kinds don't require a recompile,
    /// but publishers should reference the constants for spelling
    /// safety.
    pub kind: String,

    /// Free-form JSON payload. Each `kind` documents its own shape.
    #[schema(value_type = Object)]
    pub payload: Value,

    /// One of the `SOURCE_*` constants. Free-form `String` on the wire
    /// for the same forward-compat reason as `kind`.
    pub source: String,

    /// When the event was published. Set by [`EventBus::publish`] if
    /// the caller leaves it at `DateTime::<Utc>::MIN_UTC`, otherwise
    /// preserved (so replay through `publish_existing` keeps the
    /// original timestamp).
    #[serde(with = "chrono::serde::ts_milliseconds")]
    pub created_at: DateTime<Utc>,
}

impl EventEnvelope {
    /// Build a fresh envelope with `created_at = Utc::now()`. Most
    /// publishers should use this — the only reason to construct
    /// manually is replay from the persisted log.
    pub fn new(
        tenant_id: ObjectId,
        kind: impl Into<String>,
        payload: Value,
        source: impl Into<String>,
    ) -> Self {
        Self {
            tenant_id,
            kind: kind.into(),
            payload,
            source: source.into(),
            created_at: Utc::now(),
        }
    }

    /// Render this envelope as a BSON document for insertion into
    /// `sabchat_events`. `_id` is freshly allocated so the caller can
    /// read it back for the replay route.
    pub(crate) fn to_doc(&self, id: ObjectId) -> Document {
        let payload_bson = bson::Bson::try_from(self.payload.clone()).unwrap_or(bson::Bson::Null);
        doc! {
            "_id": id,
            "tenantId": self.tenant_id,
            "kind": &self.kind,
            "payload": payload_bson,
            "source": &self.source,
            "createdAt": bson::DateTime::from_chrono(self.created_at),
        }
    }
}

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

/// In-process event bus for SabChat domain events.
///
/// Cloning is cheap — both the `broadcast::Sender` and the
/// [`MongoHandle`] are `Arc`-backed. Subscribers obtain a receiver via
/// [`EventBus::subscribe`]; publishers call [`EventBus::publish`].
///
/// `publish` does two things, in order:
///
/// 1. Inserts a row into `sabchat_events` (best-effort — Mongo write
///    failure is logged at `warn!` but does **not** abort the publish,
///    since the bus is more important than the log for hot-path
///    consumers).
/// 2. Broadcasts the envelope on the in-process channel. A
///    `broadcast::SendError` is silently ignored — it only fires when
///    there are zero active receivers, which is a normal startup state.
#[derive(Clone)]
pub struct EventBus {
    tx: tokio::sync::broadcast::Sender<EventEnvelope>,
    mongo: MongoHandle,
}

impl EventBus {
    /// Build a fresh bus with a capacity-[`BUS_CAPACITY`] broadcast
    /// channel. Call once at process startup and stash the result in
    /// the orchestrator state — every other crate clones from there.
    pub fn new(mongo: MongoHandle) -> Self {
        let (tx, _rx) = tokio::sync::broadcast::channel(BUS_CAPACITY);
        Self { tx, mongo }
    }

    /// Hand out a new subscriber receiver. Each call yields an
    /// independent `Receiver` — events broadcast after this call land
    /// in this receiver's buffer; events broadcast earlier do not.
    pub fn subscribe(&self) -> tokio::sync::broadcast::Receiver<EventEnvelope> {
        self.tx.subscribe()
    }

    /// Internal Mongo handle accessor — exposed `pub(crate)` so the
    /// HTTP handlers can read the persisted log without re-threading
    /// the handle.
    #[allow(dead_code)]
    pub(crate) fn mongo(&self) -> &MongoHandle {
        &self.mongo
    }

    /// Append an envelope to `sabchat_events` AND broadcast it on the
    /// in-process channel.
    ///
    /// Steps:
    ///
    /// 1. Allocate a fresh `ObjectId` for the persisted row.
    /// 2. `insert_one(envelope.to_doc(id))` — failures logged but not
    ///    propagated.
    /// 3. `self.tx.send(envelope)` — failures (no active subscribers)
    ///    silently ignored.
    ///
    /// Returns the allocated `_id` so the caller can correlate the
    /// envelope with downstream log entries.
    pub async fn publish(&self, env: EventEnvelope) -> anyhow::Result<ObjectId> {
        let id = ObjectId::new();

        // Best-effort persist. We log on failure but do not abort —
        // the bus is the primary delivery mechanism; the log is the
        // backup.
        let doc = env.to_doc(id);
        let coll = self.mongo.collection::<Document>(EVENTS_COLL);
        if let Err(e) = coll.insert_one(doc).await {
            warn!(error = %e, kind = %env.kind, "sabchat_events: persist failed");
        }

        // Broadcast. `SendError` only fires when there are zero active
        // subscribers — fine on startup, fine in tests.
        let _ = self.tx.send(env);

        Ok(id)
    }

    /// Re-broadcast an envelope that already exists in the log without
    /// inserting a duplicate row. Used by the replay route so workers
    /// that came up late can re-attach without polluting the log with
    /// fake-fresh events.
    pub fn publish_existing(&self, env: EventEnvelope) {
        let _ = self.tx.send(env);
    }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/// Build the SabChat events router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/events`):
///
/// ```text
/// GET   /                          — list_events
/// GET   /{id}                      — get_event
/// POST  /replay/{id}               — replay_event
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatEventsState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Route ordering note:** the literal `/replay/{id}` segment is
/// registered before the `/{id}` pattern so axum's matcher prefers the
/// literal over the `{id}` parameter.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatEventsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- literal segment first ------------------------------------
        .route("/replay/{id}", post(handlers::replay_event))
        // ---- collection + per-event endpoints -------------------------
        .route("/", get(handlers::list_events))
        .route("/{id}", get(handlers::get_event))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_kinds_are_unique_and_dotted() {
        let mut seen = std::collections::HashSet::new();
        for k in ALL_KINDS {
            assert!(seen.insert(*k), "duplicate kind: {k}");
            assert!(k.contains('.'), "kind not dotted: {k}");
        }
    }

    #[test]
    fn envelope_to_doc_roundtrips_core_fields() {
        let tenant = ObjectId::new();
        let env = EventEnvelope::new(
            tenant,
            KIND_MESSAGE_CREATED,
            serde_json::json!({ "messageId": "abc" }),
            SOURCE_SYSTEM,
        );
        let id = ObjectId::new();
        let doc = env.to_doc(id);
        assert_eq!(doc.get_object_id("_id").unwrap(), id);
        assert_eq!(doc.get_object_id("tenantId").unwrap(), tenant);
        assert_eq!(doc.get_str("kind").unwrap(), KIND_MESSAGE_CREATED);
        assert_eq!(doc.get_str("source").unwrap(), SOURCE_SYSTEM);
    }
}
