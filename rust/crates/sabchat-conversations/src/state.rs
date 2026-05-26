//! State slice consumed by the SabChat conversations router.
//!
//! Handlers only need a Mongo handle today — every endpoint is a write
//! or read over the `sabchat_conversations`, `sabchat_assignments`, and
//! `sabchat_audit_log` collections. Future caching layers (Redis for
//! inbox counts, for example) will move in here so callers don't have
//! to thread them.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the conversations router needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatConversationsState {
    pub mongo: MongoHandle,
}

impl SabChatConversationsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
