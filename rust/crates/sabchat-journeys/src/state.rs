//! State slice consumed by the SabChat journeys router.
//!
//! Handlers are pure Mongo I/O over four collections
//! (`sabchat_journeys`, `sabchat_journey_runs`, `sabchat_journey_outbox`,
//! and read-only `sabchat_contacts` for tag-segment enrollment), so the
//! bundle is just a Mongo handle today.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the journeys router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatJourneysState {
    pub mongo: MongoHandle,
}

impl SabChatJourneysState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
