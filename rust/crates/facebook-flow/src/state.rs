//! State bundle wired into the API binary.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct FacebookFlowState {
    pub mongo: MongoHandle,
}

impl FacebookFlowState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
