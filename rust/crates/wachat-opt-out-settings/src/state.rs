//! State slice (Mongo handle) for the wachat-opt-out-settings router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatOptOutSettingsState {
    pub mongo: MongoHandle,
}

impl WachatOptOutSettingsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
