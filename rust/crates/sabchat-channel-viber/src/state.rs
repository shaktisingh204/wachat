use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct SabChatChannelViberState {
    pub mongo: MongoHandle,
}

impl SabChatChannelViberState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
