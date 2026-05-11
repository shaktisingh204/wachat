//! Per-handler state for the telegram-webhooks slice.

use sabnode_db::mongo::MongoHandle;

use crate::bot_api::BotApiClient;

/// State injected into every webhook handler.
///
/// * `mongo` — shared Mongo handle, used by every collection in this crate.
/// * `bot_api` — Bot API HTTP client for the live `setWebhook` /
///   `getWebhookInfo` / `deleteWebhook` calls when a user edits a sub.
/// * `app_url` — `NEXT_PUBLIC_APP_URL` (or `VERCEL_URL`) at boot time;
///   used as the default origin when we replay a delivery to the
///   Next.js receiver at `/api/telegram/webhook/{botId}`.
#[derive(Clone)]
pub struct TelegramWebhooksState {
    pub mongo: MongoHandle,
    pub bot_api: BotApiClient,
    pub app_url: String,
}

impl TelegramWebhooksState {
    pub fn new(mongo: MongoHandle, bot_api: BotApiClient, app_url: String) -> Self {
        Self {
            mongo,
            bot_api,
            app_url,
        }
    }
}
