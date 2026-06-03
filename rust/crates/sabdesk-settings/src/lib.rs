pub mod models;
pub mod mock_db;
pub mod handlers;
pub mod routes;

pub use mock_db::{AppState, MockDb};
pub use routes::create_router;
use std::sync::Arc;

pub fn initialize_app() -> axum::Router {
    let mock_db = Arc::new(MockDb::new());
    let state = AppState { db: mock_db };
    create_router(state)
}
