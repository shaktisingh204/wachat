use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct TelegramPaymentsState {
    pub mongo: MongoHandle,
    pub http: reqwest::Client,
}

impl TelegramPaymentsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self {
            mongo,
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .expect("reqwest client"),
        }
    }
}
