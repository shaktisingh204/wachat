//! # telegram-business-inbox
//!
//! Unified Telegram inbox across all of a project's bots. Each
//! underlying chat (a row in the `telegram_chats` collection owned by
//! the `telegram-chats` crate) is promoted into an "inbox thread" with
//! a status lifecycle (open → pending → snoozed → resolved → archived),
//! optional agent assignment, tags, priority, internal notes, and SLA
//! tracking.
//!
//! Auto-reply (`telegram-auto-reply`) is expected to fire **before** a
//! message lands in this inbox; any uncovered inbound message is what
//! the inbox queues for human follow-up. The webhook handler calls
//! [`upsert_thread_from_message`] after persisting the inbound message.
//!
//! Mount under `/v1/telegram/business-inbox`.

pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post, put},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use handlers::{evaluate_slas, upsert_thread_from_message};
pub use state::TelegramBusinessInboxState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramBusinessInboxState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ------------------------------------------------------------------ threads
        .route("/threads", get(handlers::list_threads))
        .route("/threads/bulk", post(handlers::bulk_threads))
        .route(
            "/threads/upsert-from-message",
            post(handlers::upsert_thread_endpoint),
        )
        .route("/threads/{id}", get(handlers::get_thread))
        .route("/threads/{id}/assign", post(handlers::assign_thread))
        .route("/threads/{id}/status", post(handlers::set_status))
        .route("/threads/{id}/tags", post(handlers::set_tags))
        .route("/threads/{id}/priority", post(handlers::set_priority))
        .route("/threads/{id}/mark-read", post(handlers::mark_read))
        .route("/threads/{id}/messages", get(handlers::list_messages))
        .route(
            "/threads/{id}/notes",
            get(handlers::list_notes).post(handlers::create_note),
        )
        .route(
            "/threads/{id}/notes/{note_id}",
            delete(handlers::delete_note),
        )
        // ------------------------------------------------------------------ auto-assign rules
        .route(
            "/auto-assign",
            get(handlers::list_auto_assign).post(handlers::create_auto_assign),
        )
        .route(
            "/auto-assign/{id}",
            put(handlers::update_auto_assign).delete(handlers::delete_auto_assign),
        )
        .route("/auto-assign/reorder", post(handlers::reorder_auto_assign))
        // ------------------------------------------------------------------ SLA policies
        .route("/sla", get(handlers::list_sla).post(handlers::create_sla))
        .route(
            "/sla/{id}",
            put(handlers::update_sla).delete(handlers::delete_sla),
        )
        .route("/sla/eval", post(handlers::sla_eval))
        // ------------------------------------------------------------------ misc
        .route("/agents", get(handlers::list_agents))
        .route("/analytics", get(handlers::analytics))
}
