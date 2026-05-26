//! State slice consumed by the SabChat contacts router.
//!
//! Handlers only need a Mongo handle today — the contact endpoints are
//! pure CRUD over the `sabchat_contacts` and `sabchat_audit_log`
//! collections. Any future per-tenant cache (Redis) will move in here
//! so callers don't have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the SabChat contacts router needs. Cheap to clone
/// — the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatContactsState {
    pub mongo: MongoHandle,
}

impl SabChatContactsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
