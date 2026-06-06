//! State slice (Mongo handle) for the wachat-contact-merge router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatContactMergeState {
    pub mongo: MongoHandle,
}

impl WachatContactMergeState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
