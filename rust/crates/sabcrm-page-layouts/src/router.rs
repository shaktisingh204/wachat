//! Axum router for the SabCRM record-page-layout HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/page-layouts", sabcrm_page_layouts::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/page-layouts`):
//!
//! ```text
//! GET    /         — get_layout          (?projectId=&object=[&withDefault=])
//! GET    /default  — get_default_layout  (?projectId=&object=)
//! PUT    /         — save_layout         (?projectId=&object=, JSON body)
//! DELETE /         — reset_layout        (?projectId=&object=)
//! ```

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the SabCRM page-layouts router. See module docs for the route
/// table and state contract.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::get_layout)
                .put(handlers::save_layout)
                .delete(handlers::reset_layout),
        )
        .route("/default", get(handlers::get_default_layout))
}
