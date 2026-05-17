use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct DeveloperOauthState {
    pub mongo: MongoHandle,
}

impl DeveloperOauthState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
