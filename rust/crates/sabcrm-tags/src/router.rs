//! Axum router for the SabCRM tags HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/tags", sabcrm_tags::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/tags`):
//!
//! ```text
//! GET    /               — list_tags (with usage counts)
//! POST   /               — create_tag
//! GET    /counts         — tag_counts
//! GET    /for-record     — tags_for_record
//! GET    /{id}           — get_tag
//! PATCH  /{id}           — update_tag
//! DELETE /{id}           — delete_tag (cascades assignments)
//! POST   /{id}/apply     — apply_tag
//! DELETE /{id}/apply     — remove_tag
//! GET    /{id}/records   — tagged_records
//! ```

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::get,
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the SabCRM tags router. See module docs for the route table and
/// state contract.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_tags).post(handlers::create_tag))
        .route("/counts", get(handlers::tag_counts))
        .route("/for-record", get(handlers::tags_for_record))
        .route(
            "/{id}",
            get(handlers::get_tag)
                .patch(handlers::update_tag)
                .delete(handlers::delete_tag),
        )
        .route(
            "/{id}/apply",
            axum::routing::post(handlers::apply_tag).delete(handlers::remove_tag),
        )
        .route("/{id}/records", get(handlers::tagged_records))
}
