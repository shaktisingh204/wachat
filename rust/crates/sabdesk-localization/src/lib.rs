pub mod models;
pub mod mock_db;
pub mod handlers;
pub mod routes;

pub use mock_db::{MockDb, create_mock_db};
pub use routes::create_router;

pub async fn run() {
    let db = create_mock_db();
    let app = create_router(db);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3004").await.unwrap();
    println!("sabdesk-localization running on port 3004");
    axum::serve(listener, app).await.unwrap();
}
