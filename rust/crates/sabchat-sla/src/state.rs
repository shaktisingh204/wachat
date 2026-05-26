//! State slice consumed by the SabChat SLA router.
//!
//! Handlers only need a Mongo handle — the SLA endpoints are pure CRUD
//! over the `sabchat_sla_policies` collection plus targeted writes
//! against `sabchat_conversations` (the `apply` and `sweep` paths).
//! Any future per-tenant cache layer (Redis) for the
//! [`crate::pick_policy_for`] helper would move in here so callers
//! don't have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the SabChat SLA router needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatSlaState {
    pub mongo: MongoHandle,
}

impl SabChatSlaState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
