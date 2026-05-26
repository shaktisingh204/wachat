//! State slice consumed by the SabChat teams router.
//!
//! Handlers only need a Mongo handle today — the team / skill / presence
//! endpoints are pure CRUD over four collections (`sabchat_teams`,
//! `sabchat_skills`, `sabchat_agent_skills`, `sabchat_agent_presence`).
//! Any future per-tenant cache (Redis) for the presence read path will
//! move in here so callers don't have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the teams router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatTeamsState {
    pub mongo: MongoHandle,
}

impl SabChatTeamsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
