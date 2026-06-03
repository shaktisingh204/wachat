use sabdesk_field_service::{mock_db::create_db_state, routes::app_router};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    let db_state = create_db_state();
    let app = app_router(db_state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8083));
    println!("Sabdesk Field Service running on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
