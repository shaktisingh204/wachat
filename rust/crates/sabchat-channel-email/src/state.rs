//! State slice consumed by the SabChat email channel router.
//!
//! Handlers only need a Mongo handle today — ingestion is pure
//! Mongo I/O across `sabchat_inboxes`, `sabchat_contacts`,
//! `sabchat_conversations`, and `sabchat_messages`. A future async
//! fan-out hook (broadcast to `sabchat-ws`, fire a routing
//! evaluation, etc.) would land here too so callers don't have to
//! thread it through `Router::with_state`.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the email channel router needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatChannelEmailState {
    pub mongo: MongoHandle,
}

impl SabChatChannelEmailState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
