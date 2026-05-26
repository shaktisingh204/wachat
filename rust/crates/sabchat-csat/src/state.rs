//! State slice consumed by the SabChat CSAT routers.
//!
//! Handlers only need a Mongo handle today — every CSAT operation is
//! straight Mongo I/O over `sabchat_surveys`, `sabchat_survey_responses`,
//! `sabchat_widget_sessions`, `sabchat_conversations`, and
//! `sabchat_messages`. Any future caching layer (Redis-backed stats,
//! say) would move in here so callers don't have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the CSAT routers need. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatCsatState {
    pub mongo: MongoHandle,
}

impl SabChatCsatState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
