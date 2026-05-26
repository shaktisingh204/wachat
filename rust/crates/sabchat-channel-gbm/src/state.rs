use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct SabChatChannelGbmState {
    pub mongo: MongoHandle,
}

impl SabChatChannelGbmState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
