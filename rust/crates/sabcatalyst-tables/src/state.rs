use sabnode_db::mongo::MongoHandle;
#[derive(Clone)]
pub struct SabcatalystTablesState { pub mongo: MongoHandle }
impl SabcatalystTablesState { pub fn new(mongo: MongoHandle) -> Self { Self { mongo } } }
