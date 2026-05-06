//! State bundle for the `telegram-bots` router.
//!
//! Each handler needs Mongo (for the `telegram_bots` and `projects`
//! collections) plus the public-facing `app_url` that we use to build
//! webhook targets like `{app_url}/api/telegram/webhook/{bot_id_hex}`.

use sabnode_db::mongo::MongoHandle;

use crate::bot_api::BotApiClient;

#[derive(Clone)]
pub struct TelegramBotsState {
    pub mongo: MongoHandle,
    pub bot_api: BotApiClient,
    /// HTTPS origin used to compose webhook URLs. Read from
    /// `NEXT_PUBLIC_APP_URL` (or `VERCEL_URL`) at boot. May be empty —
    /// in that case, `connectTelegramBot` saves the bot but skips
    /// `setWebhook` and surfaces a hint in the response.
    pub app_url: String,
}

impl TelegramBotsState {
    pub fn new(mongo: MongoHandle, bot_api: BotApiClient, app_url: String) -> Self {
        Self {
            mongo,
            bot_api,
            app_url,
        }
    }
}
