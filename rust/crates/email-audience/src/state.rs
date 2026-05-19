//! Shared state for the audience router. Mongo handle only — no queues.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct EmailAudienceState {
    pub mongo: MongoHandle,
}
