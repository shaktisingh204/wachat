//! State bundle wired into the API binary.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Bundle of handles every meta-flows endpoint needs.
///
/// `MetaClient` is reused for retry/timeout-shaped JSON calls; the more
/// exotic Flows-only operations (multipart `/assets` upload, opaque
/// asset-download URL fetch, paginated `next` URLs) are issued via
/// [`crate::meta_http`] which holds its own `reqwest::Client`.
#[derive(Clone)]
pub struct MetaFlowsState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
    pub http: meta_http::Client,
}

use crate::meta_http;

impl MetaFlowsState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self {
            mongo,
            meta,
            http: meta_http::Client::default(),
        }
    }
}
