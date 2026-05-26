//! State slice consumed by the SabChat reports router.
//!
//! Reports are pure read aggregations against the SabChat collections
//! (`sabchat_conversations`, `sabchat_messages`, `sabchat_assignments`,
//! `sabchat_audit_log`, `sabchat_inboxes`). The handlers therefore need
//! nothing more than a Mongo handle.
//!
//! Future state (a per-tenant Redis cache for the live-queue widget,
//! pre-computed daily rollup collection, …) would slot in here so
//! sibling crates don't have to thread it.
//!
//! Cheap to `Clone` — the inner [`MongoHandle`] is `Arc`-backed.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the SabChat reports router needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatReportsState {
    pub mongo: MongoHandle,
}

impl SabChatReportsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
