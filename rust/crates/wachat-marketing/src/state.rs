//! Shared handles for every wachat-marketing handler.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Bundle of handles every marketing endpoint needs. Mirrors
/// `WachatCallingState` / `WachatPayState` so the API crate's `FromRef`
/// plumbing stays uniform.
#[derive(Clone)]
pub struct WachatMarketingState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatMarketingState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
