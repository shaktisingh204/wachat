//! State slice consumed by the SabChat inboxes router.
//!
//! Handlers only need a Mongo handle today — every endpoint reads and
//! writes one or two collections (`sabchat_inboxes`, with audit rows
//! appended to `sabchat_audit_log`). Any future per-tenant caching
//! layer (Redis) will move in here so callers don't have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the inboxes router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatInboxesState {
    pub mongo: MongoHandle,
}

impl SabChatInboxesState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
