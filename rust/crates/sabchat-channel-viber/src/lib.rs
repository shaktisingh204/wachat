pub mod dto;
pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::post};

pub use state::SabChatChannelViberState;
pub use sabchat_types::ChannelType;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatChannelViberState: FromRef<S>,
{
    Router::new()
        .route("/ingest", post(handlers::ingest))
        .route("/subscribed", post(handlers::subscribed))
        .route("/unsubscribed", post(handlers::unsubscribed))
        .route("/delivered", post(handlers::delivered))
}
