//! Shared handle for wachat-webhook-calls handlers (DB-only).

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatWebhookCallsState {
    pub mongo: MongoHandle,
}

impl WachatWebhookCallsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
