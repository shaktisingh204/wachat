//! State slice (Mongo handle) for the wachat-post-generator router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatPostGeneratorState { pub mongo: MongoHandle }
impl WachatPostGeneratorState { pub fn new(mongo: MongoHandle) -> Self { Self { mongo } } }
