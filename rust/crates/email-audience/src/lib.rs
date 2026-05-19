//! # email-audience
//!
//! Phase 1 of the SabNode Email Suite Rust port. HTTP surface for the audience
//! domain: lists, subscribers, segments, tags, custom fields.
//!
//! Routes mount **relative**; the orchestrating `api` crate nests under
//! `/v1/email/audience`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, patch, post},
};
use sabnode_auth::AuthConfig;

pub mod dto;
pub mod handlers;
pub mod segments;
pub mod state;

pub use state::EmailAudienceState;

/// Build the audience router.
///
/// ```text
/// # Lists
/// GET    /lists
/// POST   /lists
/// GET    /lists/{id}
/// PATCH  /lists/{id}
/// DELETE /lists/{id}                      # archive (soft delete)
/// GET    /lists/{id}/subscribers
///
/// # Subscribers
/// GET    /subscribers
/// POST   /subscribers
/// GET    /subscribers/{id}
/// PATCH  /subscribers/{id}
/// DELETE /subscribers/{id}                # archive
/// POST   /subscribers/import              # multipart CSV
/// GET    /subscribers/export              # CSV stream
///
/// # Segments
/// GET    /segments
/// POST   /segments
/// GET    /segments/{id}
/// PATCH  /segments/{id}
/// DELETE /segments/{id}
/// POST   /segments/preview                # evaluate ad-hoc filter without saving
/// POST   /segments/{id}/recount           # refresh cached count
///
/// # Tags + custom fields
/// GET    /tags                            # distinct tags in tenant
/// GET    /fields                          # custom field schema
/// PUT    /fields                          # replace custom field schema
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    EmailAudienceState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Lists
        .route("/lists", get(handlers::list_lists).post(handlers::create_list))
        .route(
            "/lists/{id}",
            get(handlers::get_list).patch(handlers::update_list).delete(handlers::archive_list),
        )
        .route("/lists/{id}/subscribers", get(handlers::list_subscribers_in_list))
        // Subscribers
        .route(
            "/subscribers",
            get(handlers::list_subscribers).post(handlers::create_subscriber),
        )
        .route("/subscribers/import", post(handlers::import_subscribers))
        .route("/subscribers/export", get(handlers::export_subscribers))
        .route(
            "/subscribers/{id}",
            get(handlers::get_subscriber)
                .patch(handlers::update_subscriber)
                .delete(handlers::archive_subscriber),
        )
        // Segments
        .route("/segments", get(handlers::list_segments).post(handlers::create_segment))
        .route("/segments/preview", post(handlers::preview_segment))
        .route(
            "/segments/{id}",
            get(handlers::get_segment).patch(handlers::update_segment).delete(handlers::delete_segment),
        )
        .route("/segments/{id}/recount", post(handlers::recount_segment))
        // Tags + fields
        .route("/tags", get(handlers::list_tags))
        .route("/fields", get(handlers::get_fields).put(handlers::put_fields))
        // Stub for routes wired later — keep compiler happy
        .route("/_health", get(handlers::health))
        .route("/_unused", patch(|| async { "" }).delete(|| async { "" }))
}
