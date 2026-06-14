//! State slice consumed by the SabChat action-taking-AI router.
//!
//! Handlers do Mongo I/O over `sabchat_ai_connectors` /
//! `sabchat_ai_action_runs`, plus an outbound HTTP call (the `http_webhook`
//! executor) via a shared [`reqwest::Client`].

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the actions router needs. Cheap to clone — both the
/// `MongoHandle` and `reqwest::Client` are `Arc`-backed internally.
#[derive(Clone)]
pub struct SabChatAiActionsState {
    pub mongo: MongoHandle,
    pub http: reqwest::Client,
}

impl SabChatAiActionsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self {
            mongo,
            http: reqwest::Client::new(),
        }
    }
}
