//! Shared handle for wachat-identity handlers (DB-only; no Meta calls).

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatIdentityState {
    pub mongo: MongoHandle,
}

impl WachatIdentityState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
