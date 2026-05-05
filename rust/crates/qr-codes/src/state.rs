//! Shared state for `qr-codes` handlers — Mongo only (no Meta calls).

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles every qr-codes endpoint needs. Cheap to clone.
#[derive(Clone)]
pub struct QrCodesState {
    pub mongo: MongoHandle,
}

impl QrCodesState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
