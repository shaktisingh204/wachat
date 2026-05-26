//! State slice consumed by the SabChat Instagram channel adapter.
//!
//! The two webhook ingress endpoints only need a Mongo handle today — the
//! adapter is pure orchestration over the `sabchat_inboxes`,
//! `sabchat_contacts`, `sabchat_conversations`, `sabchat_messages`, and
//! `sabchat_audit_log` collections. Any future per-tenant cache (e.g. a
//! short Redis lookup of `igUserId → inboxId`) will move in here so
//! callers don't have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the SabChat Instagram channel router needs. Cheap
/// to clone — the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatChannelInstagramState {
    pub mongo: MongoHandle,
}

impl SabChatChannelInstagramState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
