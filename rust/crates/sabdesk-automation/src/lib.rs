pub mod models;
pub mod mock_db;
pub mod handlers;
pub mod routes;

pub use mock_db::MockDb;
pub use routes::create_router;

use axum::Router;

pub fn app() -> Router {
    let db = MockDb::new();
    create_router(db)
}
