//! State slice consumed by the SabChat SMS channel adapter.
//!
//! The adapter is pure CRUD over the SabChat collections
//! (`sabchat_inboxes`, `sabchat_contacts`, `sabchat_conversations`,
//! `sabchat_messages`), so the only handle it needs today is a Mongo
//! connection. Anything else (Redis fan-out for live agent UI, outbound
//! delivery queue, …) will land here later so callers don't have to
//! thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the SMS channel router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatChannelSmsState {
    pub mongo: MongoHandle,
}

impl SabChatChannelSmsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
