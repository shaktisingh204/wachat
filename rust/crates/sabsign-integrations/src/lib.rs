pub mod handlers;
pub mod mock_db;
pub mod models;
pub mod routes;

use axum::Router;
use mock_db::MockDb;
use routes::app_routes;

pub fn create_app() -> Router {
    let db = MockDb::new();
    app_routes().with_state(db)
}
