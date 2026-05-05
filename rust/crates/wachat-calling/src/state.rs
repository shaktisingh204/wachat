//! Shared handles for every wachat-calling handler.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Bundle of handles every calling endpoint needs.
///
/// Mirrors `WachatConfigState` and `WachatPayState` so the API crate's
/// `FromRef` plumbing stays uniform.
#[derive(Clone)]
pub struct WachatCallingState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatCallingState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
