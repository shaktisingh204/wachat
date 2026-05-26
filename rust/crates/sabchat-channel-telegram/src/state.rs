//! State slice consumed by the SabChat Telegram channel-adapter router.
//!
//! The adapter is pure CRUD over Mongo: it resolves the target inbox by
//! bot username, finds-or-creates a `sabchat_contacts` row keyed on the
//! Telegram `from_id`, finds-or-creates the latest open
//! `sabchat_conversations` row, and appends one `sabchat_messages`
//! document per inbound update. No Redis, no WebSocket fan-out (that
//! happens in `sabchat-ws` after the row lands).
//!
//! There is no JWT-derived tenancy here — this surface is
//! server-to-server, called by the Telegram webhook shim inside the
//! same deployment. Tenant scope is derived from the resolved inbox's
//! `tenant_id`.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the SabChat Telegram channel router needs. Cheap
/// to clone — the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatChannelTelegramState {
    pub mongo: MongoHandle,
}

impl SabChatChannelTelegramState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
