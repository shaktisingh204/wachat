//! State slice consumed by the SabChat compliance router.
//!
//! Handlers only need a Mongo handle today — every endpoint is a
//! straightforward read or write against one of the
//! `sabchat_dsr_requests`, `sabchat_dsr_exports`,
//! `sabchat_retention_rules`, `sabchat_contacts`,
//! `sabchat_conversations`, `sabchat_messages`, `sabchat_events`, or
//! `sabchat_audit_log` collections.
//!
//! Wrapped in its own struct (rather than passing `MongoHandle`
//! directly) so future additions — a Redis lock for the sweep job, a
//! SabFiles handle for export blob uploads — can move in here without
//! rippling through call sites.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the compliance router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatComplianceState {
    pub mongo: MongoHandle,
}

impl SabChatComplianceState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
