//! State slice (Mongo handle) for the wachat-canned-messages router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatCannedMessagesState {
    pub mongo: MongoHandle,
}

impl WachatCannedMessagesState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
