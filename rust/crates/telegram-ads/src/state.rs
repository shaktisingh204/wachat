use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct TelegramAdsState {
    pub mongo: MongoHandle,
}

impl TelegramAdsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
