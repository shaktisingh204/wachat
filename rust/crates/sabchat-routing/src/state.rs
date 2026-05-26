//! State slice consumed by the SabChat routing router.
//!
//! Routing handlers only need a Mongo handle today — they fan out across
//! `sabchat_inboxes`, `sabchat_conversations`, `sabchat_assignments` and
//! `sabchat_audit_log`. Any future caching layer (e.g. an in-memory
//! per-inbox load index) will move in here so callers don't have to thread
//! it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the routing router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatRoutingState {
    pub mongo: MongoHandle,
}

impl SabChatRoutingState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
