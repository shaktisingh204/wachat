//! State bundle for the telegram-stickers router.
//!
//! We carry our own [`BotApiClient`] so the wider workspace state
//! plumbing does not need to thread an extra dependency through the api
//! crate — `new(mongo)` stays the same constructor signature.

use sabnode_db::mongo::MongoHandle;

use crate::bot_api::BotApiClient;

#[derive(Clone)]
pub struct TelegramStickersState {
    pub mongo: MongoHandle,
    pub bot_api: BotApiClient,
    /// reqwest client used by the handlers to pull SabFile bytes
    /// server-side before forwarding them to `uploadStickerFile`.
    pub http: reqwest::Client,
}

impl TelegramStickersState {
    pub fn new(mongo: MongoHandle) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .unwrap_or_default();
        Self {
            mongo,
            bot_api: BotApiClient::new(),
            http,
        }
    }
}
