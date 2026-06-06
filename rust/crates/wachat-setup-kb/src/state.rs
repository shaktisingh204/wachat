//! State slice (Mongo handle) for the wachat-setup-kb router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatSetupKbState {
    pub mongo: MongoHandle,
}

impl WachatSetupKbState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
