use sabnode_db::mongo::MongoHandle;
#[derive(Clone)]
pub struct SabcatalystApiKeysState {
    pub mongo: MongoHandle,
}
impl SabcatalystApiKeysState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
