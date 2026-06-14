//! # sabchat-community
//!
//! Axum router that owns the **community forum** HTTP surface for
//! SabChat. Mounted under `/v1/sabchat/community` from the orchestrating
//! `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/community", sabchat_community::router::<AppState>())
//! ```
//!
//! ## Why a separate crate
//!
//! Self-service deflection: a tenant runs a public Q&A forum where
//! customers (and agents) post questions, reply, upvote, and accept
//! answers. Answered topics are durable content the KB + resolve-bot can
//! draw on, shrinking inbound volume. Keeping it a leaf crate lets the UI
//! and any future indexer depend on a single small dependency.
//!
//! ## Routes
//!
//! | Method  | Path                    | Handler        | Notes                         |
//! |---------|-------------------------|----------------|-------------------------------|
//! | `POST`  | `/topics`               | `create_topic` | Tenant-scoped.                |
//! | `GET`   | `/topics`               | `list_topics`  | Pinned first; `?sort=top`.    |
//! | `GET`   | `/topics/{id}`          | `get_topic`    | Topic + its replies.          |
//! | `PATCH` | `/topics/{id}`          | `update_topic` | Partial; moderation + edits.  |
//! | `DELETE`| `/topics/{id}`          | `delete_topic` | Cascades to replies.          |
//! | `POST`  | `/topics/{id}/upvote`   | `upvote_topic` | Toggle.                       |
//! | `POST`  | `/topics/{id}/posts`    | `create_post`  | Add a reply.                  |
//! | `POST`  | `/posts/{id}/upvote`    | `upvote_post`  | Toggle.                       |
//! | `POST`  | `/posts/{id}/answer`    | `mark_answer`  | Accept a reply as the answer. |
//! | `DELETE`| `/posts/{id}`           | `delete_post`  | Moderation.                   |
//!
//! ## Collections
//!
//! | Direction | Collection                  | Owner       |
//! |-----------|-----------------------------|-------------|
//! | r/w       | `sabchat_community_topics`  | this crate  |
//! | r/w       | `sabchat_community_posts`   | this crate  |
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`; the handlers
//! need a [`SabChatCommunityState`] bundle (a Mongo handle) and an
//! `Arc<AuthConfig>`, both pulled via [`FromRef`](axum::extract::FromRef)
//! so this crate stays decoupled from the orchestrator's `AppState`.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatCommunityState;

/// Build the sabchat community router (mounted relative under
/// `/v1/sabchat/community`).
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatCommunityState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/topics",
            post(handlers::create_topic).get(handlers::list_topics),
        )
        .route(
            "/topics/{id}",
            get(handlers::get_topic)
                .patch(handlers::update_topic)
                .delete(handlers::delete_topic),
        )
        .route("/topics/{id}/upvote", post(handlers::upvote_topic))
        .route("/topics/{id}/posts", post(handlers::create_post))
        .route("/posts/{id}/upvote", post(handlers::upvote_post))
        .route("/posts/{id}/answer", post(handlers::mark_answer))
        .route("/posts/{id}", delete(handlers::delete_post))
}
