//! State slice for the webhooks control plane.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct DeveloperWebhooksState {
    pub mongo: MongoHandle,
}

impl DeveloperWebhooksState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
