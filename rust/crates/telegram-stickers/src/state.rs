use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct TelegramStickersState {
    pub mongo: MongoHandle,
}

impl TelegramStickersState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
