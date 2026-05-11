use sabnode_db::mongo::MongoHandle;

use crate::bot_api::BotApiClient;

#[derive(Clone)]
pub struct TelegramChannelsState {
    pub mongo: MongoHandle,
    pub bot_api: BotApiClient,
}

impl TelegramChannelsState {
    /// Keeps the legacy single-arg constructor used by `api::main` —
    /// the channel handlers need an HTTP client to talk to
    /// `api.telegram.org`, but it has no configuration of its own.
    pub fn new(mongo: MongoHandle) -> Self {
        Self {
            mongo,
            bot_api: BotApiClient::new(),
        }
    }
}
