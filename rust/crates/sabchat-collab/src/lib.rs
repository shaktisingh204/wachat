//! # sabchat-collab
//!
//! Axum router that owns the **collaboration** HTTP surface for SabChat.
//! Mounted under `/v1/sabchat/collab` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/collab", sabchat_collab::router::<AppState>())
//! ```
//!
//! Two agent-collaboration primitives that hang off a conversation:
//!
//! * **Side conversations** — a private internal side-thread to discuss a
//!   conversation with a teammate without the customer seeing it.
//! * **Conversation links** — relate two conversations (same customer, a
//!   duplicate, a follow-up).
//!
//! ## Routes
//!
//! | Method  | Path                       | Handler              |
//! |---------|----------------------------|----------------------|
//! | `POST`  | `/side`                    | `create_side`        |
//! | `GET`   | `/side?parentConversationId=` | `list_side`       |
//! | `DELETE`| `/side/{id}`               | `delete_side`        |
//! | `GET`   | `/side/{id}/messages`      | `list_side_messages` |
//! | `POST`  | `/side/{id}/messages`      | `create_side_message`|
//! | `POST`  | `/links`                   | `create_link`        |
//! | `GET`   | `/links?conversationId=`   | `list_links`         |
//! | `DELETE`| `/links/{id}`              | `delete_link`        |
//!
//! Every endpoint requires [`AuthUser`](sabnode_auth::AuthUser) and filters
//! all I/O on the JWT tenant claim.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatCollabState;

/// Build the sabchat collab router (mounted relative under
/// `/v1/sabchat/collab`).
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatCollabState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/side", post(handlers::create_side).get(handlers::list_side))
        .route("/side/{id}", axum::routing::delete(handlers::delete_side))
        .route(
            "/side/{id}/messages",
            get(handlers::list_side_messages).post(handlers::create_side_message),
        )
        .route("/links", post(handlers::create_link).get(handlers::list_links))
        .route("/links/{id}", axum::routing::delete(handlers::delete_link))
}
