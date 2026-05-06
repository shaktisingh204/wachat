use sabnode_db::mongo::MongoHandle;
use telegram_bots::bot_api::BotApiClient;

#[derive(Clone)]
pub struct TelegramBroadcastsState {
    pub mongo: MongoHandle,
    pub bot_api: BotApiClient,
}

impl TelegramBroadcastsState {
    pub fn new(mongo: MongoHandle, bot_api: BotApiClient) -> Self {
        Self { mongo, bot_api }
    }
}
