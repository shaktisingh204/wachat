//! State slice consumed by the SabChat LINE channel-adapter router.
//!
//! The adapter is pure CRUD over Mongo: it resolves the target inbox by
//! LINE `channelId`, finds-or-creates a `sabchat_contacts` row keyed on
//! the LINE `userId`, finds-or-creates the latest open
//! `sabchat_conversations` row, and appends one `sabchat_messages`
//! document per inbound event. No Redis, no WebSocket fan-out (that
//! happens in `sabchat-ws` after the row lands).
//!
//! There is no JWT-derived tenancy here — this surface is
//! server-to-server, called by the LINE webhook shim inside the same
//! deployment. Tenant scope is derived from the resolved inbox's
//! `tenant_id`.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the SabChat LINE channel router needs. Cheap
/// to clone — the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatChannelLineState {
    pub mongo: MongoHandle,
}

impl SabChatChannelLineState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
