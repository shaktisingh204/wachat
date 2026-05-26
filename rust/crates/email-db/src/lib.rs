pub mod entity;
pub mod migration;

use sea_orm::DatabaseConnection;

#[derive(Clone)]
pub struct EmailDb {
    pub db: DatabaseConnection,
}

impl EmailDb {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}
