pub mod models;
pub mod mock_db;
pub mod handlers;
pub mod routes;

pub use mock_db::{MockDatabase, DbState};
pub use routes::create_router;
use std::sync::Arc;
use tokio::sync::RwLock;

pub fn initialize_db() -> DbState {
    Arc::new(RwLock::new(MockDatabase::new()))
}
