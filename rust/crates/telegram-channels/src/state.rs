use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct TelegramChannelsState {
    pub mongo: MongoHandle,
}

impl TelegramChannelsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
