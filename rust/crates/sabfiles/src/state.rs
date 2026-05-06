//! Process-wide state for the SabFiles domain.
//!
//! Bundles a Mongo handle (the directory tree lives in
//! `sabfiles_nodes`) with an R2 client (object storage). The R2 client
//! is wrapped in an `Arc` so cloning the state is cheap.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;

use crate::r2::R2Client;

#[derive(Clone)]
pub struct SabfilesState {
    pub mongo: MongoHandle,
    pub r2: Arc<R2Client>,
    /// Per-user storage quota in bytes, or `None` for unlimited.
    /// Populated from `SABFILES_USER_QUOTA_BYTES`.
    pub quota_bytes: Option<u64>,
}

impl SabfilesState {
    pub fn new(mongo: MongoHandle, r2: Arc<R2Client>, quota_bytes: Option<u64>) -> Self {
        Self {
            mongo,
            r2,
            quota_bytes,
        }
    }
}
