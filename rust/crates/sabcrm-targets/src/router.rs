//! Axum router for the SabCRM targets HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/targets", sabcrm_targets::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/targets`):
//!
//! ```text
//! GET    /             — list_for_source  (records a source points at)
//! POST   /             — link_target      (idempotent upsert)
//! DELETE /             — unlink_target
//! GET    /for-record   — list_for_record  (sources on a record)
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

/// Build the SabCRM targets router. See module docs for the route table
/// and state contract.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_for_source)
                .post(handlers::link_target)
                .delete(handlers::unlink_target),
        )
        .route("/for-record", get(handlers::list_for_record))
}
