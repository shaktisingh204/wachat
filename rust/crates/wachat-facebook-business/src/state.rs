//! State slice consumed by the Facebook Business Admin & Commerce router.
//!
//! Bundles a Mongo handle (tenancy + project lookup) with a shared
//! `MetaClient` so handlers can forward Graph calls without rebuilding the
//! HTTP transport per request.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Handles every Facebook Business / Commerce endpoint needs.
#[derive(Clone)]
pub struct WachatFacebookBusinessState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatFacebookBusinessState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
