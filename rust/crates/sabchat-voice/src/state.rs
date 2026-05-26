//! State slice consumed by the SabChat voice router.
//!
//! Handlers only need a Mongo handle today — every endpoint is either
//! a CRUD operation over `sabchat_calls` or a pure provider-adapter
//! call (the adapter is a no-op stub at present). Future state — a
//! per-tenant LiveKit / Daily.co credential cache, a Redis-backed
//! "rooms currently active" counter for dashboard rollups — slots in
//! here so sibling crates don't have to thread it.
//!
//! Cheap to `Clone` — the inner [`MongoHandle`] is `Arc`-backed.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the SabChat voice router needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatVoiceState {
    pub mongo: MongoHandle,
}

impl SabChatVoiceState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
