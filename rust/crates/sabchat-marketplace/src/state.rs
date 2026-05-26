//! State slice consumed by the SabChat marketplace router.
//!
//! Handlers only need a Mongo handle today to access `sabchat_installed_apps`.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the marketplace router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatMarketplaceState {
    pub mongo: MongoHandle,
}

impl SabChatMarketplaceState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
