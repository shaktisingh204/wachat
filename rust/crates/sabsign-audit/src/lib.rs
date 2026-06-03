pub mod handlers;
pub mod mock_db;
pub mod models;
pub mod routes;

pub use mock_db::AppState;
pub use routes::create_router;

pub async fn run() {
    let state = AppState::new();
    let app = create_router(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
