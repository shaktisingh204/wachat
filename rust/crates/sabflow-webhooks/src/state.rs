use std::sync::Arc;

use sabnode_auth::AuthConfig;
use sabnode_db::{mongo::MongoHandle, redis::RedisHandle};
use wachat_queue::BullProducer;

#[derive(Clone)]
pub struct SabflowWebhooksState {
    pub mongo: MongoHandle,
    pub redis: RedisHandle,
    pub bull: BullProducer,
    pub auth: Arc<AuthConfig>,
}

impl SabflowWebhooksState {
    pub fn new(
        mongo: MongoHandle,
        redis: RedisHandle,
        bull: BullProducer,
        auth: Arc<AuthConfig>,
    ) -> Self {
        Self {
            mongo,
            redis,
            bull,
            auth,
        }
    }
}
