use sabnode_db::mongo::MongoHandle;
#[derive(Clone)]
pub struct SabcatalystUsageState { pub mongo: MongoHandle }
impl SabcatalystUsageState { pub fn new(mongo: MongoHandle) -> Self { Self { mongo } } }
