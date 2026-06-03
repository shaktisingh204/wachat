pub mod models;
pub mod mock_db;
pub mod handlers;
pub mod routes;

pub use mock_db::create_app_state;
pub use routes::create_router;

// Optionally, a run function for integration or to start the server directly
pub async fn run_server(port: u16) {
    let state = create_app_state();
    let app = create_router(state);
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("Listening on {}", addr);
    axum::serve(listener, app).await.unwrap();
}
