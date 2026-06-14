//! State slice consumed by the SabChat community-forum router.
//!
//! Handlers are pure Mongo I/O over two collections
//! (`sabchat_community_topics`, `sabchat_community_posts`), so the bundle
//! is just a Mongo handle today. Any future per-tenant moderation cache
//! moves in here so callers don't have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the community router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatCommunityState {
    pub mongo: MongoHandle,
}

impl SabChatCommunityState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
