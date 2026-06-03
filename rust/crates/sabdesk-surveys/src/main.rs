use sabdesk_surveys::create_router;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    let app = create_router();

    let listener = TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Listening on {}", listener.local_addr().unwrap());

    axum::serve(listener, app).await.unwrap();
}
