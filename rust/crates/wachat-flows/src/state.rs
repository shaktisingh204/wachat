//! State slice consumed by the wachat-flows router.
//!
//! Today only a Mongo handle is needed — flow execution / cache invalidation
//! lives elsewhere. Put any per-project flow caches here when they land.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatFlowsState {
    pub mongo: MongoHandle,
}

impl WachatFlowsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
