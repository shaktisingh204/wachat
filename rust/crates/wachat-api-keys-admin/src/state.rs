//! State slice consumed by the admin API-key router.
//!
//! Handlers only need a Mongo handle; the `wachat_public_api` verifier
//! reads the same collection from a separate state slice on the request
//! path. Kept thin so it can be embedded directly in `AppState` via
//! `FromRef`.

use sabnode_db::mongo::MongoHandle;

/// Shared state for the admin API-key endpoints. Cheap to clone — the
/// Mongo handle is already `Arc`-backed.
#[derive(Clone)]
pub struct WachatApiKeysAdminState {
    pub mongo: MongoHandle,
}

impl WachatApiKeysAdminState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
