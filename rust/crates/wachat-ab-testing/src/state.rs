//! State slice (Mongo handle) for the wachat-ab-testing router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatAbTestingState {
    pub mongo: MongoHandle,
}

impl WachatAbTestingState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
