//! # sabchat-channel-whatsapp
//!
//! Adapter glue between Wachat (the SabNode WhatsApp Cloud API stack)
//! and SabChat (the unified omnichannel inbox). Owns two HTTP routes
//! plus one public helper:
//!
//! Mounted under `/v1/sabchat/channels/whatsapp` from the
//! orchestrating `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/sabchat/channels/whatsapp",
//!     sabchat_channel_whatsapp::router::<AppState>(),
//! )
//! ```
//!
//! ## HTTP surface
//!
//! | Method | Path       | Handler                | Purpose                                |
//! |--------|------------|------------------------|----------------------------------------|
//! | POST   | `/ingest`  | [`handlers::ingest`]   | inbound message → SabChat graph        |
//! | POST   | `/status`  | [`handlers::status`]   | delivery receipt for an outbound msg   |
//!
//! ## Server-to-server contract
//!
//! Both routes are called by the existing
//! [`wachat-webhook-inbound`][1] crate (or any future webhook crate)
//! inside the same deployment. There is no `AuthUser` extractor and no
//! JWT check — the calling crate is trusted, and tenant scope is
//! derived from the resolved SabChat inbox's `tenant_id` field.
//!
//! ## Idempotency
//!
//! Meta retries webhook deliveries on any timeout / 5xx. The `/ingest`
//! handler dedupes on `providerMetadata.wamid == providerMessageId`,
//! returning the existing `(conversationId, messageId)` pair and
//! `deduped: true` for repeat deliveries. The `/status` handler is
//! naturally idempotent — `$set` of the same `(status, statusAt)` is a
//! no-op at the document level.
//!
//! ## Collections touched
//!
//! | Collection             | Read | Write | Notes                                     |
//! |------------------------|------|-------|-------------------------------------------|
//! | `sabchat_inboxes`      | yes  | no    | resolve by `channelConfig.settings.phoneNumberId` |
//! | `sabchat_contacts`     | yes  | yes   | match-or-create on `socialIds`            |
//! | `sabchat_conversations`| yes  | yes   | latest `Open` thread, else create         |
//! | `sabchat_messages`     | yes  | yes   | append + dedupe on `providerMetadata.wamid`|
//! | `sabchat_audit_log`    | no   | yes   | one event per state transition            |
//!
//! ## Public helpers
//!
//! [`resolve_or_create_conversation`] exposes the same find-or-create
//! semantics the `/ingest` handler uses, so other adapters or worker
//! jobs (template-send, bulk-broadcast follow-up ingest) can land
//! messages on the same conversation graph without re-implementing
//! the lookup.
//!
//! [1]: ../wachat_webhook_inbound/index.html

pub mod dto;
pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::post};
use bson::oid::ObjectId;
use sabnode_db::mongo::MongoHandle;

pub use state::SabChatChannelWhatsappState;

// ---------------------------------------------------------------------------
// Collection name constants
// ---------------------------------------------------------------------------
//
// All five collections are referenced from both the handlers module and
// the public helper — keep the literal strings here so a future rename
// is a single-line change.

/// SabChat inbox / channel registry. See `sabchat_types::SabChatInbox`.
pub(crate) const INBOXES_COLL: &str = "sabchat_inboxes";

/// Deduped cross-channel contact identity. See
/// `sabchat_types::SabChatContact`.
pub(crate) const CONTACTS_COLL: &str = "sabchat_contacts";

/// Conversation rows keyed by `(tenant, inbox, contact)`. See
/// `sabchat_types::SabChatConversation`.
pub(crate) const CONVERSATIONS_COLL: &str = "sabchat_conversations";

/// Per-message rows. See `sabchat_types::SabChatMessage`.
pub(crate) const MESSAGES_COLL: &str = "sabchat_messages";

/// Append-only audit log. See `sabchat_types::SabChatAuditEvent`.
pub(crate) const AUDIT_COLL: &str = "sabchat_audit_log";

/// Stable wire discriminant for the WhatsApp Cloud channel — matches
/// `sabchat_types::ChannelType::WhatsappCloud`'s `serde(rename_all =
/// "snake_case")` output. Inlined as a string so we can use it
/// directly inside Mongo filter `doc!{}`s.
pub(crate) const WHATSAPP_CHANNEL_TYPE: &str = "whatsapp_cloud";

/// `SocialIdentity.provider` value used for WhatsApp social ids on
/// `sabchat_contacts.socialIds[]`. Stable wire string — do not rename
/// without a migration.
pub(crate) const WHATSAPP_PROVIDER: &str = "whatsapp";

/// Build the SabChat WhatsApp channel-adapter router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/channels/whatsapp`):
///
/// ```text
/// POST   /ingest      — ingest one inbound message
/// POST   /status      — apply a delivery receipt
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatChannelWhatsappState`] bundle; it is pulled via
/// [`FromRef`] so this crate stays decoupled from the orchestrator's
/// `AppState` struct. There is no `Arc<AuthConfig>` requirement —
/// this surface is server-to-server.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatChannelWhatsappState: FromRef<S>,
{
    Router::new()
        .route("/ingest", post(handlers::ingest))
        .route("/status", post(handlers::status))
}

/// Find the latest open conversation on `(inbox, contact)` for the
/// inbox's tenant, or create a fresh one. Public re-export of the
/// helper the `/ingest` handler uses, so other crates (template
/// senders, broadcast follow-ups, manual landing from the agent UI)
/// can route messages onto the same conversation graph without
/// re-implementing the lookup.
///
/// Returns the conversation id (hex-ready `ObjectId`).
///
/// ## Tenancy
///
/// We re-resolve the inbox to learn its tenant — callers usually
/// already have it, but accepting an inbox id keeps the surface
/// trivial and matches the on-disk source of truth. A missing inbox
/// surfaces as an `Err` rather than panicking.
pub async fn resolve_or_create_conversation(
    mongo: &MongoHandle,
    inbox_id: ObjectId,
    contact_id: ObjectId,
) -> anyhow::Result<ObjectId> {
    use bson::{Document, doc};

    let inbox = mongo
        .collection::<Document>(INBOXES_COLL)
        .find_one(doc! { "_id": inbox_id })
        .await?
        .ok_or_else(|| anyhow::anyhow!("sabchat_inboxes row not found for id {inbox_id}"))?;
    let tenant_id = inbox
        .get_object_id("tenantId")
        .map_err(|_| anyhow::anyhow!("sabchat_inboxes row missing tenantId"))?;

    let (conv_id, _) =
        handlers::find_or_create_open_conversation(mongo, tenant_id, inbox_id, contact_id)
            .await
            .map_err(|e| anyhow::anyhow!("resolve_or_create_conversation: {e}"))?;
    Ok(conv_id)
}
