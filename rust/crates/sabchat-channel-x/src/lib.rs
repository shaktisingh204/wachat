pub mod dto;
pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::post};

pub use state::SabChatChannelXState;

/// Re-export of the [`ChannelType`] discriminant this adapter targets.
pub use sabchat_types::ChannelType;

/// Build the SabChat X channel-adapter router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/channels/x`):
///
/// ```text
/// POST /ingest    — handlers::ingest
/// POST /delivered — handlers::delivered
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatChannelXState: FromRef<S>,
{
    Router::new()
        .route("/ingest", post(handlers::ingest))
        .route("/delivered", post(handlers::delivered))
}
