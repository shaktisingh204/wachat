//! State bundle for the `telegram-chats` router.
//!
//! Each handler needs Mongo (for `telegram_chats`, `telegram_messages`,
//! `telegram_bots`, `projects`) plus the shared
//! [`telegram_bots::bot_api::BotApiClient`] for outbound
//! `sendMessage`/`sendChatAction` calls.

use sabnode_db::mongo::MongoHandle;
use telegram_bots::bot_api::BotApiClient;

#[derive(Clone)]
pub struct TelegramChatsState {
    pub mongo: MongoHandle,
    pub bot_api: BotApiClient,
}

impl TelegramChatsState {
    pub fn new(mongo: MongoHandle, bot_api: BotApiClient) -> Self {
        Self { mongo, bot_api }
    }
}
