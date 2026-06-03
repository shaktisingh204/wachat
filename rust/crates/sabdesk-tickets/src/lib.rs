pub mod handlers;
pub mod mock_db;
pub mod models;
pub mod routes;

pub use mock_db::{AppState, MockDatabase};
pub use routes::build_router;
use std::sync::Arc;
use tokio::sync::RwLock;

pub fn app() -> axum::Router {
    let state = AppState {
        db: Arc::new(RwLock::new(MockDatabase::new())),
    };
    build_router(state)
}
