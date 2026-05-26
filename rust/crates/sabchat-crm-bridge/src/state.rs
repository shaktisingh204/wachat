//! State slice consumed by the SabChat ↔ CRM bridge router.
//!
//! Handlers only need a Mongo handle today — every endpoint is pure
//! cross-collection plumbing between `sabchat_*` and `crm_*` collections.
//! Any future per-tenant cache (Redis) would move in here so callers
//! don't have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the bridge router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatCrmBridgeState {
    pub mongo: MongoHandle,
}

impl SabChatCrmBridgeState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
