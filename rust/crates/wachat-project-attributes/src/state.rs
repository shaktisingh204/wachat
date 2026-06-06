//! State slice (Mongo handle) for the wachat-project-attributes router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatProjectAttributesState {
    pub mongo: MongoHandle,
}

impl WachatProjectAttributesState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
