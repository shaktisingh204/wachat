pub mod entity;
pub mod migration;

use sea_orm::DatabaseConnection;

#[derive(Clone)]
pub struct SabsmsDb {
    pub db: DatabaseConnection,
}

impl SabsmsDb {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}
