//! Axum router for the SabCRM generic records HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState` without this crate having to know
//! the concrete state struct:
//!
//! ```ignore
//! .nest("/v1/sabcrm/records", sabcrm_records::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/records`):
//!
//! ```text
//! GET    /{object}             — list_records
//! POST   /{object}             — create_record
//! GET    /{object}/count       — count_records
//! POST   /{object}/group       — group_records   (kanban)
//! POST   /{object}/bulk-delete — bulk_delete_records
//! POST   /{object}/bulk-update — bulk_update_records
//! POST   /{object}/merge       — merge_records
//! POST   /{object}/aggregate   — aggregate_records
//! GET    /{object}/distinct/{field} — distinct_values
//! GET    /{object}/duplicates  — find_duplicates
//! GET    /{object}/{id}        — get_record
//! PATCH  /{object}/{id}        — update_record
//! DELETE /{object}/{id}        — delete_record
//! GET    /{object}/{id}/related — record_relations
//! ```

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the SabCRM records router. See module docs for the route table
/// and state contract.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/{object}",
            get(handlers::list_records).post(handlers::create_record),
        )
        .route("/{object}/count", get(handlers::count_records))
        .route("/{object}/group", post(handlers::group_records))
        .route(
            "/{object}/bulk-delete",
            post(handlers::bulk_delete_records),
        )
        .route(
            "/{object}/bulk-update",
            post(handlers::bulk_update_records),
        )
        .route("/{object}/merge", post(handlers::merge_records))
        .route("/{object}/aggregate", post(handlers::aggregate_records))
        .route(
            "/{object}/distinct/{field}",
            get(handlers::distinct_values),
        )
        .route("/{object}/duplicates", get(handlers::find_duplicates))
        .route(
            "/{object}/{id}",
            get(handlers::get_record)
                .patch(handlers::update_record)
                .delete(handlers::delete_record),
        )
        .route(
            "/{object}/{id}/related",
            get(handlers::record_relations),
        )
}
