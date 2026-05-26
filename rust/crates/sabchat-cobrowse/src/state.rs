//! State slice consumed by the SabChat co-browse routers.
//!
//! Both routers (agent + public) read and write a single Mongo
//! collection (`sabchat_cobrowse_sessions`), so the only handle they
//! need today is a Mongo connection. Anything else — a Redis presence
//! cache for the live co-browse driver, a broadcast bus for fan-out to
//! the agent UI — will land here later so callers don't have to thread
//! it through.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the co-browse routers need. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatCobrowseState {
    pub mongo: MongoHandle,
}

impl SabChatCobrowseState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
