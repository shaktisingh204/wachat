//! State bundle for the `wachat-facebook-comments` router.
//!
//! Each handler needs Mongo (project lookup + token resolution) plus a
//! Meta Graph API client. The TS originals talked to `v23.0`; the API
//! binary is responsible for constructing the `MetaClient` with the right
//! base URL.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

#[derive(Clone)]
pub struct WachatFacebookCommentsState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatFacebookCommentsState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
