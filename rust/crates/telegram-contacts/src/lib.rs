//! # telegram-contacts
//!
//! Projects-scoped Telegram contact directory. Records are mirrored
//! from `telegram_chats` (private chats), enriched with tags, custom
//! fields, agent assignment, and may also be created manually or via
//! CSV import. Segments persist saved filters and produce paginated
//! contact lists.
//!
//! Mount under `/v1/telegram/contacts`.

pub mod dto;
pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramContactsState;

// Re-export the pure-rust callable so the future webhook crate can
// upsert contacts without going through HTTP.
pub use handlers::resolve_contact;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramContactsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Core CRUD
        .route("/", get(handlers::list).post(handlers::upsert))
        // CSV import / export
        .route("/import", post(handlers::import_csv))
        .route("/export", get(handlers::export_csv))
        // Sync from chats
        .route("/sync-from-chats", post(handlers::sync_from_chats))
        // Bulk
        .route("/bulk-delete", post(handlers::bulk_delete))
        .route("/bulk-tag", post(handlers::bulk_tag))
        .route("/bulk-assign", post(handlers::bulk_assign))
        // Segments
        .route(
            "/segments",
            get(handlers::list_segments).post(handlers::create_segment),
        )
        .route(
            "/segments/{segment_id}/contacts",
            get(handlers::segment_contacts),
        )
        .route("/segments/{segment_id}", delete(handlers::delete_segment))
        // Analytics
        .route("/analytics", get(handlers::analytics))
        // Internal resolve (webhook entry point)
        .route("/resolve", post(handlers::resolve))
        // Detail / update / delete by id — registered last so the
        // path matcher prefers literal routes above.
        .route(
            "/{contact_id}",
            get(handlers::detail)
                .put(handlers::update)
                .delete(handlers::delete_contact),
        )
}
