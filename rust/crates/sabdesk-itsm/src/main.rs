use sabdesk_itsm::{mock_db::create_shared_state, routes::build_router};

#[tokio::main]
async fn main() {
    let state = create_shared_state();
    let app = build_router(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Server running on http://0.0.0.0:3000");
    axum::serve(listener, app).await.unwrap();
}
