//! State slice consumed by the wachat contacts router.
//!
//! Handlers only need a Mongo handle today — the contact endpoints are
//! pure CRUD over the `contacts` and `projects` collections. Any future
//! per-project caching layer (Redis) will move in here so callers don't
//! have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the contacts router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct WachatContactsState {
    pub mongo: MongoHandle,
}

impl WachatContactsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
