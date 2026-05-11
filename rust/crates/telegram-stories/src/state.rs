use sabnode_db::mongo::MongoHandle;

/// Shared state for the telegram-stories crate.
///
/// Holds the Mongo handle plus a reusable reqwest client for outbound
/// Bot API calls (postStory / editStory / deleteStory / business
/// connection queries).
#[derive(Clone)]
pub struct TelegramStoriesState {
    pub mongo: MongoHandle,
    pub http: reqwest::Client,
}

impl TelegramStoriesState {
    pub fn new(mongo: MongoHandle) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .expect("reqwest::Client::builder()");
        Self { mongo, http }
    }
}
