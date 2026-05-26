//! State slice consumed by the SabChat audit router.
//!
//! The audit log is append-only and lives in a single Mongo collection
//! (`sabchat_audit_log`). The handlers therefore need nothing more than
//! a Mongo handle — there is no cache, no projection store, no
//! per-tenant index. Future state (a write-amplification queue, a
//! Redis-backed counter for dashboard rollups) would slot in here so
//! sibling crates don't have to thread it.
//!
//! Cheap to `Clone` — the inner [`MongoHandle`] is `Arc`-backed.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the SabChat audit router needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatAuditState {
    pub mongo: MongoHandle,
}

impl SabChatAuditState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
