//! State slice (Mongo handle) for the wachat-integrations-hub router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatIntegrationsHubState {
    pub mongo: MongoHandle,
}

impl WachatIntegrationsHubState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
