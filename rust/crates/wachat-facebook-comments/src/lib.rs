//! # wachat-facebook-comments
//!
//! Ports the **Facebook comments / replies / likes / reactions / private
//! replies** slice of `src/app/actions/facebook.actions.ts` to a Rust BFF
//! surface. Seven handlers, all originally `axios` calls against
//! `https://graph.facebook.com/v23.0/…`.
//!
//! Mount under `/v1/facebook/comments` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/facebook/comments", wachat_facebook_comments::router::<AppState>())
//! ```
//!
//! ## Auth & access
//!
//! All handlers extract a [`sabnode_auth::AuthUser`] from the JWT and call
//! [`handlers::load_project_for`] to confirm the caller owns the target
//! project before any Graph API call — mirroring the `getProjectById()`
//! access check in the TS code.
//!
//! ## Token resolution
//!
//! Each handler reads `accessToken` from the `projects` collection. The
//! Comments slice does **not** need `facebookPageId` because every Graph
//! call is keyed on the path-supplied object/comment id.
//!
//! ## Graph API client
//!
//! Outbound traffic goes through [`wachat_meta_client::MetaClient`]. The TS
//! originals pass the token via `?access_token=…` query string; we let
//! the client thread it as `Authorization: Bearer …` (which Meta accepts
//! equivalently).

pub mod dto;
pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::WachatFacebookCommentsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFacebookCommentsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // handlePostComment / handleDeleteComment
        // POST   /{object_id}     — post a comment on a post/comment
        // DELETE /{comment_id}    — delete a comment
        .route(
            "/{object_id}",
            post(handlers::handle_post_comment).delete(handlers::handle_delete_comment),
        )
        // handleLikeObject — POST /{object_id}/likes
        .route("/{object_id}/likes", post(handlers::handle_like_object))
        // getPostComments — GET /post/{post_id}
        // (under /post/ to disambiguate from /{comment_id}/replies)
        .route("/post/{post_id}", get(handlers::get_post_comments))
        // getCommentReplies — GET /{comment_id}/replies
        .route("/{comment_id}/replies", get(handlers::get_comment_replies))
        // getObjectReactions — GET /{object_id}/reactions
        .route(
            "/{object_id}/reactions",
            get(handlers::get_object_reactions),
        )
        // sendPrivateReply — POST /{comment_id}/private-replies
        .route(
            "/{comment_id}/private-replies",
            post(handlers::send_private_reply),
        )
}
