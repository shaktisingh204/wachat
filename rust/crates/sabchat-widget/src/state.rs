//! State slice consumed by the SabChat widget router.
//!
//! The widget endpoints are pure CRUD over the SabChat collections
//! (`sabchat_inboxes`, `sabchat_contacts`, `sabchat_conversations`,
//! `sabchat_messages`, `sabchat_widget_sessions`, `sabchat_audit_log`),
//! so the only handle they need today is a Mongo connection. Anything
//! else (Redis presence cache, broadcast bus, …) will land here later
//! so callers don't have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the widget router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatWidgetState {
    pub mongo: MongoHandle,
}

impl SabChatWidgetState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
