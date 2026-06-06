//! State slice (Mongo handle) for the wachat-flow-events router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatFlowEventsState {
    pub mongo: MongoHandle,
}

impl WachatFlowEventsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
