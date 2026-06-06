//! State slice (Mongo handle) for the wachat-interactive-builder router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatInteractiveBuilderState {
    pub mongo: MongoHandle,
}

impl WachatInteractiveBuilderState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
