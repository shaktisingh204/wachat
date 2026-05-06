use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct TelegramAutoReplyState {
    pub mongo: MongoHandle,
}

impl TelegramAutoReplyState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
