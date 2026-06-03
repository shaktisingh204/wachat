use sabnode_db::mongo::MongoHandle;
#[derive(Clone)]
pub struct SabcatalystAuthSessionsState {
    pub mongo: MongoHandle,
}
impl SabcatalystAuthSessionsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
