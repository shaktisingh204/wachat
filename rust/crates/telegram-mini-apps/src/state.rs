use sabnode_db::mongo::MongoHandle;
use telegram_bots::bot_api::BotApiClient;

/// State for the mini-apps slice.
///
/// We piggy-back our own [`BotApiClient`] instance because the action
/// endpoints (`/send`, `/set-menu-button`) talk to Telegram directly.
/// Constructing a fresh `BotApiClient` here keeps the public
/// `TelegramMiniAppsState::new(mongo)` signature unchanged — the API
/// crate wires us up with one arg only — at the cost of one extra HTTP
/// client. The client is `Clone`-cheap (`reqwest::Client` is an `Arc`
/// inside) so the duplication is essentially free.
#[derive(Clone)]
pub struct TelegramMiniAppsState {
    pub mongo: MongoHandle,
    pub bot_api: BotApiClient,
}

impl TelegramMiniAppsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self {
            mongo,
            bot_api: BotApiClient::new(),
        }
    }
}
