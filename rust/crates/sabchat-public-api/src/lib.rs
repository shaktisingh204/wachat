//! # sabchat-public-api
//!
//! Public REST API surface for SabChat — the API-key-authenticated endpoints
//! that customers (and partner integrations) hit directly. Mounted at
//! `/v1/sabchat/public/*`.
//!
//! ## Auth
//!
//! Reuses [`ApiKeyAuth`] from `wachat_public_api` which pulls a bearer token
//! off the request and looks up the `api_keys` collection.

#![forbid(unsafe_code)]

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
use sabnode_db::mongo::MongoHandle;

pub use state::SabChatPublicApiState;
use wachat_public_api::ApiKeyVerifier;

/// Build the public-API router.
///
/// Routes:
/// ```text
/// GET  /contacts
/// POST /contacts
/// GET  /contacts/{id}
/// GET  /conversations
/// GET  /conversations/{id}
/// GET  /conversations/{id}/messages
/// POST /conversations/{id}/messages
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatPublicApiState: FromRef<S>,
    Arc<ApiKeyVerifier>: FromRef<S>,
    MongoHandle: FromRef<S>,
{
    Router::new()
        .route("/contacts", get(handlers::list_contacts).post(handlers::create_contact))
        .route("/contacts/:id", get(handlers::get_contact))
        .route("/conversations", get(handlers::list_conversations))
        .route("/conversations/:id", get(handlers::get_conversation))
        .route(
            "/conversations/:id/messages",
            get(handlers::list_messages).post(handlers::append_message),
        )
}
