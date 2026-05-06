use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct TelegramMiniAppsState {
    pub mongo: MongoHandle,
}

impl TelegramMiniAppsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
