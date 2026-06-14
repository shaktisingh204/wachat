//! State bundle for the `wachat-facebook-content` router.
//!
//! Each handler needs Mongo (project lookup) plus a Meta Graph API client.
//! We pin the client to `v23.0` to match the legacy TS, but the API binary
//! constructs the `MetaClient` so tests and alternate environments can
//! swap in `MetaClient::with_base`.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Pinned Meta Graph API version. Mirrors the hard-coded `v23.0` strings
/// in `src/app/actions/facebook.actions.ts`.
pub const META_API_VERSION: &str = "v25.0";

#[derive(Clone)]
pub struct WachatFacebookContentState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatFacebookContentState {
    /// Construct from the API binary. The `meta` client should be built
    /// with [`META_API_VERSION`].
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
