//! State slice consumed by the SabChat collaboration router.
//!
//! Pure Mongo I/O over `sabchat_side_conversations` / `sabchat_side_messages`
//! / `sabchat_conversation_links`, so the bundle is just a Mongo handle.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the collab router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatCollabState {
    pub mongo: MongoHandle,
}

impl SabChatCollabState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
