//! State slice consumed by the SabChat knowledge-base router.
//!
//! Handlers only need a Mongo handle today — every endpoint reads and
//! writes one of three collections (`sabchat_kb_portals`,
//! `sabchat_kb_categories`, `sabchat_kb_articles`). Any future
//! per-portal caching layer (Redis) will move in here so callers don't
//! have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the knowledge-base router needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatKnowledgeState {
    pub mongo: MongoHandle,
}

impl SabChatKnowledgeState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
