//! State bundle consumed by the wachat-facebook-messaging router.
//!
//! All handlers need a Mongo handle (project lookup) and a MetaClient
//! (Graph API). Both are cheap to clone — `MongoHandle` is `Arc`-backed
//! and `MetaClient` wraps a `reqwest::Client` whose internals are also
//! `Arc`-backed.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

#[derive(Clone)]
pub struct WachatFacebookMessagingState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatFacebookMessagingState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
