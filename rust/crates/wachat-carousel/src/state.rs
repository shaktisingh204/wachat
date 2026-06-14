//! Shared handles for every wachat-carousel handler.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Bundle of handles every carousel endpoint needs. Mirrors
/// `WachatCallingState` / `WachatMarketingState`.
#[derive(Clone)]
pub struct WachatCarouselState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatCarouselState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
