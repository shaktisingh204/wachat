use sabnode_db::mongo::MongoHandle;
#[derive(Clone)]
pub struct SabcatalystInvocationsState { pub mongo: MongoHandle }
impl SabcatalystInvocationsState { pub fn new(mongo: MongoHandle) -> Self { Self { mongo } } }
