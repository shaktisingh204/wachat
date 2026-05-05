//! Shared handles for every wachat-pay handler.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Bundle of handles every payment-configuration endpoint needs.
///
/// Mirrors `WachatConfigState` from the sibling `wachat-config` crate so
/// the API crate's `FromRef` plumbing stays uniform.
#[derive(Clone)]
pub struct WachatPayState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatPayState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
