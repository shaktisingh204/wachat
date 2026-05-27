use sabnode_db::mongo::MongoHandle;
#[derive(Clone)]
pub struct SabcatalystAuthUsersState { pub mongo: MongoHandle }
impl SabcatalystAuthUsersState { pub fn new(mongo: MongoHandle) -> Self { Self { mongo } } }
