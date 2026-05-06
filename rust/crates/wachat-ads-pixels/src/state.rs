//! State bundle for the Ad Manager Pixels-and-friends domain endpoints.
//!
//! Endpoints need:
//! * Mongo for user lookups (resolving `adManagerAccessToken` off the
//!   `users` collection — same plumbing the TS `requireToken()` helper
//!   relies on, just translated to a direct query).
//! * `MetaClient` for Graph API calls.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

#[derive(Clone)]
pub struct WachatAdsPixelsState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatAdsPixelsState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
