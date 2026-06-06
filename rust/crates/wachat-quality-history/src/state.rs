//! State slice (Mongo handle) for the wachat-quality-history router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatQualityHistoryState {
    pub mongo: MongoHandle,
}

impl WachatQualityHistoryState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
