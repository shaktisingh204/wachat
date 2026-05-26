//! Mountable router. Mount under `/v1/pagesense/sites` from the host
//! `api` crate.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_sites).post(handlers::create_site))
        .route(
            "/{siteId}",
            get(handlers::get_site)
                .patch(handlers::update_site)
                .delete(handlers::delete_site),
        )
        // Public lookup keyed by snippet key. Mounted as a subroute on
        // the same prefix; the host `api` crate is responsible for
        // excluding it from auth middleware if needed.
        .route(
            "/by-snippet-key/{snippetKey}",
            get(handlers::lookup_by_snippet_key),
        )
}
