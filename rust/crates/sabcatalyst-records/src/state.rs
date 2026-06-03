use sabnode_db::mongo::MongoHandle;
#[derive(Clone)]
pub struct SabcatalystRecordsState {
    pub mongo: MongoHandle,
}
impl SabcatalystRecordsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
