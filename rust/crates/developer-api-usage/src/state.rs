use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct DeveloperApiUsageState {
    pub mongo: MongoHandle,
}

impl DeveloperApiUsageState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
