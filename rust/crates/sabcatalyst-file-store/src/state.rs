use sabnode_db::mongo::MongoHandle;
#[derive(Clone)]
pub struct SabcatalystFileStoreState {
    pub mongo: MongoHandle,
}
impl SabcatalystFileStoreState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
