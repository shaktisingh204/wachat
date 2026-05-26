use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct SabChatChannelXState {
    pub mongo: MongoHandle,
}

impl SabChatChannelXState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
