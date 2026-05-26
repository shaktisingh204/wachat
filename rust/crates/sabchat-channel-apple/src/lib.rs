pub mod dto;
pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::post};

pub use state::SabChatChannelAppleState;

pub use sabchat_types::ChannelType;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatChannelAppleState: FromRef<S>,
{
    Router::new()
        .route("/ingest", post(handlers::ingest))
        .route("/delivered", post(handlers::delivered))
}
