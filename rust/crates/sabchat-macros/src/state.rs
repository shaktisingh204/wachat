//! State slice consumed by the SabChat macros router.
//!
//! Handlers only need a Mongo handle today — every endpoint is a write
//! or read over `sabchat_macros`, with the `run` path additionally
//! reaching `sabchat_conversations`, `sabchat_messages`, and
//! `sabchat_audit_log`. Future caching layers (e.g. shortcut →
//! macro lookups in Redis) will move in here so callers don't have to
//! thread them.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the macros router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatMacrosState {
    pub mongo: MongoHandle,
}

impl SabChatMacrosState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
