//! Shared state for the Telegram Business Inbox router.
//!
//! Only Mongo is required — the inbox is a thin coordination layer that
//! reads `telegram_chats` / `telegram_messages` / `telegram_bots` (owned
//! by the `telegram-chats` and `telegram-bots` crates) and writes its
//! own inbox-specific collections.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct TelegramBusinessInboxState {
    pub mongo: MongoHandle,
}

impl TelegramBusinessInboxState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
