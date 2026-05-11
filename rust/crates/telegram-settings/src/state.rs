use sabnode_db::mongo::MongoHandle;

/// State for the `telegram-settings` crate. Carries the shared Mongo
/// handle; settings are pure metadata so no Telegram API connection is
/// needed at this layer.
#[derive(Clone)]
pub struct TelegramSettingsState {
    pub mongo: MongoHandle,
}

impl TelegramSettingsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
