use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct SabcatalystFunctionsState {
    pub mongo: MongoHandle,
}

impl SabcatalystFunctionsState {
    pub fn new(mongo: MongoHandle) -> Self { Self { mongo } }
}
