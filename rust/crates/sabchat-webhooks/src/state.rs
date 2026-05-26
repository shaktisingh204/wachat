//! State slice consumed by the SabChat webhooks router.
//!
//! Handlers only need a Mongo handle today — every endpoint reads or
//! writes one of the three webhook collections (`sabchat_webhook_endpoints`,
//! `sabchat_webhook_deliveries`, `sabchat_webhook_dlq`). Any future
//! per-tenant rate limiter (Redis) for delivery enqueue would live here
//! so callers do not have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the webhooks router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatWebhooksState {
    pub mongo: MongoHandle,
}

impl SabChatWebhooksState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
