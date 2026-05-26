//! # sabchat-channel-gbm
//!
//! SabChat channel-adapter that ingests Google Business Messages Bot API updates
//! and lands them on the unified SabChat conversation graph.
//!
//! HTTP surface (server-to-server — no JWT):
//!   * `POST /ingest`    — ingest one inbound Google Business Messages message
//!   * `POST /delivered` — record a delivery receipt
//!

pub mod dto;
pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::post};

pub use state::SabChatChannelGbmState;
pub use sabchat_types::ChannelType;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatChannelGbmState: FromRef<S>,
{
    Router::new()
        .route("/ingest", post(handlers::ingest))
        .route("/delivered", post(handlers::delivered))
}
