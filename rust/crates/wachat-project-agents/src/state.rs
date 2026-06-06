//! State slice (Mongo handle) for the wachat-project-agents router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatProjectAgentsState {
    pub mongo: MongoHandle,
}

impl WachatProjectAgentsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
