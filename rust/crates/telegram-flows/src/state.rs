use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct TelegramFlowsState {
    pub mongo: MongoHandle,
}

impl TelegramFlowsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
