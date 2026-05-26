//! State slice consumed by the SabChat messages router.
//!
//! Handlers only need a Mongo handle today — the message endpoints are
//! pure CRUD over `sabchat_messages` with derived updates against
//! `sabchat_conversations` and `sabchat_audit_log`. Any future per-tenant
//! caching layer (Redis) will move in here so callers don't have to
//! thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the messages router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatMessagesState {
    pub mongo: MongoHandle,
}

impl SabChatMessagesState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
