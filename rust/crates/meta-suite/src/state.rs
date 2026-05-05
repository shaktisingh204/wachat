use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Bundle of handles every meta-suite endpoint needs.
#[derive(Clone)]
pub struct MetaSuiteState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl MetaSuiteState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
