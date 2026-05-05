//! Shared state for the wachat-facebook-crm router.
//!
//! Subscribers + kanban only need a Mongo handle. The label and block
//! handlers also call Meta's Graph API, so the state bundles a
//! `MetaClient` from `wachat-meta-client` (cheap to clone — it's an `Arc`
//! over `reqwest::Client`).

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

#[derive(Clone)]
pub struct WachatFacebookCrmState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatFacebookCrmState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
