//! State slice consumed by the SabChat dispositions router.
//!
//! Handlers only need a Mongo handle today — the disposition endpoints
//! are pure CRUD over `sabchat_dispositions` plus tactical writes to
//! `sabchat_conversations` and `sabchat_audit_log` on apply.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the dispositions router needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatDispositionsState {
    pub mongo: MongoHandle,
}

impl SabChatDispositionsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
