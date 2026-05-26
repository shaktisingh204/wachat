//! State slice consumed by the SabChat WhatsApp channel-adapter router.
//!
//! The adapter is pure CRUD over Mongo: it resolves the target inbox,
//! finds-or-creates a `sabchat_contacts` record, finds-or-creates the
//! latest open `sabchat_conversations` row, and appends one
//! `sabchat_messages` document per inbound webhook event. No Redis, no
//! WebSocket fan-out (that happens in `sabchat-ws` after we land the
//! row).
//!
//! There is no JWT-derived tenancy here — this surface is
//! server-to-server, called by the existing `wachat-webhook-inbound`
//! crate inside the same deployment. Tenant scope is derived from the
//! resolved inbox's `tenant_id`.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the SabChat WhatsApp channel router needs. Cheap
/// to clone — the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatChannelWhatsappState {
    pub mongo: MongoHandle,
}

impl SabChatChannelWhatsappState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
