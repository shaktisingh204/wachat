//! State slice for the SabCatalyst projects router.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct SabcatalystProjectsState {
    pub mongo: MongoHandle,
}

impl SabcatalystProjectsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
