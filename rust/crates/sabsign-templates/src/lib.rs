pub mod handlers;
pub mod mock_db;
pub mod models;
pub mod routes;

use axum::Router;
use mock_db::MockDb;

pub fn app() -> Router {
    let db = MockDb::new();
    Router::new()
        .nest("/api/v1", routes::template_routes())
        .with_state(db)
}
