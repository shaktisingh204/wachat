//! State bundle for the `telegram-chats` router.
//!
//! Each handler needs Mongo (for `telegram_chats`, `telegram_messages`,
//! `telegram_bots`, `projects`, `sabfiles_nodes`) plus the shared
//! [`telegram_bots::bot_api::BotApiClient`] for outbound `sendMessage`/
//! `sendChatAction` calls, and the local [`crate::bot_client::BotClient`]
//! for the methods the upstream client doesn't expose
//! (sendPhoto/Video/Document/Audio/Voice, editMessageCaption, copyMessage,
//! pinChatMessage, getChat, getChatMember, etc.).

use crate::bot_client::BotClient;
use sabnode_db::mongo::MongoHandle;
use telegram_bots::bot_api::BotApiClient;

#[derive(Clone)]
pub struct TelegramChatsState {
    pub mongo: MongoHandle,
    pub bot_api: BotApiClient,
    pub bot_client: BotClient,
}

impl TelegramChatsState {
    pub fn new(mongo: MongoHandle, bot_api: BotApiClient) -> Self {
        Self {
            mongo,
            bot_api,
            bot_client: BotClient::new(),
        }
    }
}
