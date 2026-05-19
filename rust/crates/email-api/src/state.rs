//! State slice consumed by the email-api router. Handlers only need a
//! Mongo handle — kept thin so it embeds directly into `AppState` via
//! `FromRef`, matching the convention used by every other email crate.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct EmailApiState {
    pub mongo: MongoHandle,
}

impl EmailApiState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
