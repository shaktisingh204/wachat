//! Shared handles for wachat-interactive handlers.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

#[derive(Clone)]
pub struct WachatInteractiveState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatInteractiveState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
