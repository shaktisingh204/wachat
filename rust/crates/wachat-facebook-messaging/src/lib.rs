//! # wachat-facebook-messaging
//!
//! Messenger & Conversations slice of `src/app/actions/facebook.actions.ts`.
//! Ports the 18 functions covering:
//!
//!   * Inbox: list/search conversations, list messages, mark-as-read,
//!     bootstrap chat data
//!   * Send: text, media, button template, generic template, quick replies
//!   * Handover Protocol: pass / take / request thread control,
//!     secondary receivers
//!   * One-time notification: opt-in request + send
//!   * Recurring notification: opt-in request + send
//!
//! All Graph API traffic flows through `wachat_meta_client::MetaClient`.
//!
//! Mount under `/v1/facebook/messaging` from the `api` crate. The router
//! is generic over the caller's outer state `S` and only requires
//! [`WachatFacebookMessagingState`] (Mongo + MetaClient) and the
//! `Arc<sabnode_auth::AuthConfig>` JWT verifier via [`FromRef`].

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub mod dto;
pub mod handlers;
pub mod state;
pub mod store;

pub use state::WachatFacebookMessagingState;

/// Build the messaging router.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFacebookMessagingState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- Conversations / messages -------------------------------------
        .route(
            "/projects/{project_id}/conversations",
            get(handlers::get_conversations),
        )
        .route(
            "/projects/{project_id}/conversations/search",
            get(handlers::search_conversations),
        )
        .route(
            "/projects/{project_id}/chat-initial-data",
            get(handlers::get_chat_initial_data),
        )
        .route(
            "/projects/{project_id}/conversations/{conversation_id}/messages",
            get(handlers::get_conversation_messages),
        )
        .route(
            "/projects/{project_id}/conversations/{conversation_id}/mark-read",
            post(handlers::mark_conversation_as_read),
        )
        // ---- Send -----------------------------------------------------------
        .route(
            "/projects/{project_id}/messages/text",
            post(handlers::send_text_message),
        )
        .route(
            "/projects/{project_id}/messages/media",
            post(handlers::send_media_message),
        )
        .route(
            "/projects/{project_id}/messages/button-template",
            post(handlers::send_button_template),
        )
        .route(
            "/projects/{project_id}/messages/generic-template",
            post(handlers::send_generic_template),
        )
        .route(
            "/projects/{project_id}/messages/quick-replies",
            post(handlers::send_quick_replies),
        )
        // ---- Handover Protocol ---------------------------------------------
        .route(
            "/projects/{project_id}/handover/pass",
            post(handlers::pass_thread_control),
        )
        .route(
            "/projects/{project_id}/handover/take",
            post(handlers::take_thread_control),
        )
        .route(
            "/projects/{project_id}/handover/request",
            post(handlers::request_thread_control),
        )
        .route(
            "/projects/{project_id}/handover/secondary-receivers",
            get(handlers::get_secondary_receivers),
        )
        // ---- One-time / recurring notifications ----------------------------
        .route(
            "/projects/{project_id}/notifications/one-time/request",
            post(handlers::send_one_time_notif_request),
        )
        .route(
            "/projects/{project_id}/notifications/one-time/send",
            post(handlers::send_one_time_notification),
        )
        .route(
            "/projects/{project_id}/notifications/recurring/opt-in",
            post(handlers::send_recurring_notif_opt_in),
        )
        .route(
            "/projects/{project_id}/notifications/recurring/send",
            post(handlers::send_recurring_notification),
        )
        // ---- WhatsApp Cloud API --------------------------------------------
        .route(
            "/projects/{project_id}/whatsapp/messages/text",
            post(handlers::send_whatsapp_text),
        )
        .route(
            "/projects/{project_id}/whatsapp/messages/template",
            post(handlers::send_whatsapp_template),
        )
        .route(
            "/projects/{project_id}/whatsapp/messages/media",
            post(handlers::send_whatsapp_media),
        )
        .route(
            "/projects/{project_id}/whatsapp/messages/interactive",
            post(handlers::send_whatsapp_interactive),
        )
}
