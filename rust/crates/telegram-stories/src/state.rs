use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct TelegramStoriesState {
    pub mongo: MongoHandle,
}

impl TelegramStoriesState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
