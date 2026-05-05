use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Bundle of handles every analytics endpoint needs.
#[derive(Clone)]
pub struct WachatAnalyticsState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatAnalyticsState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
