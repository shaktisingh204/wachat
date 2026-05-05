//! State slice consumed by the project-domain router.
//!
//! Handlers only need a Mongo handle today; tomorrow's per-project caching
//! layer (Redis) will move in here so callers don't have to thread it.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatProjectsState {
    pub mongo: MongoHandle,
}

impl WachatProjectsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
