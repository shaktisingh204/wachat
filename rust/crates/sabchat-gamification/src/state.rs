//! State slice consumed by the SabChat gamification router.
//!
//! Handlers only need a Mongo handle today — gamification is a thin
//! aggregation + ledger layer over `sabchat_conversations`,
//! `sabchat_survey_responses`, and the three `sabchat_*` write
//! collections. Any future per-tenant Redis cache for the leaderboard
//! would slot in here so sibling crates do not have to thread it.
//!
//! Cheap to `Clone` — the inner [`MongoHandle`] is `Arc`-backed.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the gamification router needs.
#[derive(Clone)]
pub struct SabChatGamificationState {
    pub mongo: MongoHandle,
}

impl SabChatGamificationState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
