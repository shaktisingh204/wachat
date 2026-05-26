//! State slice consumed by the SabChat ad-attribution router.
//!
//! Handlers only need a Mongo handle today — every endpoint is pure I/O
//! over four collections (`sabchat_ad_touches`,
//! `sabchat_ad_revenue_attributions`, `sabchat_inboxes`,
//! `sabchat_conversations`). Any future per-tenant caching layer
//! (Redis) will move in here so callers don't have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the ad-attribution router needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatAdAttributionState {
    pub mongo: MongoHandle,
}

impl SabChatAdAttributionState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
