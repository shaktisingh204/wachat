//! State slice consumed by the wachat-facebook-agents router.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatFacebookAgentsState {
    pub mongo: MongoHandle,
}

impl WachatFacebookAgentsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
