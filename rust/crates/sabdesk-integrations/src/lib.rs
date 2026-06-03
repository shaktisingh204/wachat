pub mod models;
pub mod mock_db;
pub mod handlers;
pub mod routes;

pub use mock_db::{create_db, Db};
pub use routes::create_router;


use std::net::SocketAddr;
use tokio::net::TcpListener;

pub async fn run_server(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let db = create_db();
    let app = create_router(db);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("SabDesk Integrations Microservice listening on {}", addr);
    
    let listener = TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}
