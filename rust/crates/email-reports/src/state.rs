//! State slice consumed by the email-reports router.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct EmailReportsState {
    pub mongo: MongoHandle,
}

impl EmailReportsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
