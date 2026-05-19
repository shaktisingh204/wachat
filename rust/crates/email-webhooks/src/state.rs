//! State slice consumed by the email-webhooks router. Carries the Mongo
//! handle plus a shared `reqwest::Client` so connection pooling holds
//! across deliveries.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct EmailWebhooksState {
    pub mongo: MongoHandle,
    pub http: reqwest::Client,
}

impl EmailWebhooksState {
    pub fn new(mongo: MongoHandle, http: reqwest::Client) -> Self {
        Self { mongo, http }
    }
}
