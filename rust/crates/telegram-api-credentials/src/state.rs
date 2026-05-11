//! Process-wide state for the `telegram-api-credentials` crate.
//!
//! Holds only a Mongo handle (and a shared `reqwest::Client` used by the
//! soft-verify endpoint to ping `my.telegram.org`). All persistence lives
//! in Mongo collections; there is no in-memory session store.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct TelegramApiCredentialsState {
    pub mongo: MongoHandle,
    pub http: reqwest::Client,
}

impl TelegramApiCredentialsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self {
            mongo,
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("reqwest client"),
        }
    }
}
