use sabnode_db::mongo::MongoHandle;
#[derive(Clone)]
pub struct SabcatalystDomainsState { pub mongo: MongoHandle }
impl SabcatalystDomainsState { pub fn new(mongo: MongoHandle) -> Self { Self { mongo } } }
