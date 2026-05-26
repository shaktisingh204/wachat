//! Shared state for the transactional templates router.
//!
//! Minimal — only needs a Mongo handle. Unlike `email-campaigns` we
//! don't enqueue from this crate's handlers in the common path; the
//! `test-send` endpoint delegates to whatever queue the orchestrating
//! `api` crate wires in (kept as a TODO so this crate stays
//! self-contained for the initial PR).

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct EmailTemplatesTransactionalState {
    /// Mongo handle. Cheap to clone — internally `Arc`-wrapped.
    pub mongo: MongoHandle,
}
