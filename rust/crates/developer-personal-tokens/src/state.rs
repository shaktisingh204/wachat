//! State slice consumed by the PAT router.
//!
//! Handlers only need a Mongo handle. Kept thin so it can be embedded
//! directly in `AppState` via `FromRef`, mirroring
//! [`wachat_api_keys_admin::WachatApiKeysAdminState`].

use sabnode_db::mongo::MongoHandle;

/// Shared state for the PAT endpoints. Cheap to clone — the Mongo handle
/// is already `Arc`-backed.
#[derive(Clone)]
pub struct DeveloperPersonalTokensState {
    pub mongo: MongoHandle,
}

impl DeveloperPersonalTokensState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
