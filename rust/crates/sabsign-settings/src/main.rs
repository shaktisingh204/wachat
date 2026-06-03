use sabsign_settings::{create_router, AppState, MockDb};
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::RwLock;

#[tokio::main]
async fn main() {
    let state = AppState {
        db: Arc::new(RwLock::new(MockDb::new())),
    };

    let app = create_router(state);

    let listener = TcpListener::bind("127.0.0.1:3000").await.unwrap();
    println!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}
