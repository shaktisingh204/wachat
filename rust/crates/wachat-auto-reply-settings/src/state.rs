//! State slice (Mongo handle) for the wachat-auto-reply-settings router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatAutoReplySettingsState {
    pub mongo: MongoHandle,
}

impl WachatAutoReplySettingsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
