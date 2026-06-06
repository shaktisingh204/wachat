//! State slice (Mongo handle) for the wachat-ai-training router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatAiTrainingState {
    pub mongo: MongoHandle,
}

impl WachatAiTrainingState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
