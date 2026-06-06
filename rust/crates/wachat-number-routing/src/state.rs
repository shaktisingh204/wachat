//! State slice for the wachat number-routing router. Just a Mongo handle.

use sabnode_db::mongo::MongoHandle;

/// Handles the number-routing router needs. Cheap to clone (`Arc`-backed).
#[derive(Clone)]
pub struct WachatNumberRoutingState {
    pub mongo: MongoHandle,
}

impl WachatNumberRoutingState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
