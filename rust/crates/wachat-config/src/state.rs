use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Bundle of handles every config endpoint needs.
#[derive(Clone)]
pub struct WachatConfigState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatConfigState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
