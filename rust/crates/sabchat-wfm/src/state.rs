//! State slice consumed by the SabChat WFM router. Read-only Mongo I/O over
//! `sabchat_conversations`, so the bundle is just a Mongo handle.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct SabChatWfmState {
    pub mongo: MongoHandle,
}

impl SabChatWfmState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
