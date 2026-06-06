//! State slice (Mongo handle) for the wachat-link-generator router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatLinkGeneratorState {
    pub mongo: MongoHandle,
}

impl WachatLinkGeneratorState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
