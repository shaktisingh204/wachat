use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct SabChatChannelAppleState {
    pub mongo: MongoHandle,
}

impl SabChatChannelAppleState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
