//! Axum router for the SabCRM favorites HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/favorites", sabcrm_favorites::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/favorites`):
//!
//! ```text
//! GET    /         — list_favorites
//! POST   /         — add_favorite
//! DELETE /         — remove_favorite
//! PATCH  /reorder  — reorder_favorites (bulk renumber)
//! PATCH  /move     — move_favorite    (O(1) fractional midpoint)
//! ```

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, patch},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the SabCRM favorites router. See module docs for the route table
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
            get(handlers::list_favorites)
                .post(handlers::add_favorite)
                .delete(handlers::remove_favorite),
        )
        .route("/reorder", patch(handlers::reorder_favorites))
        .route("/move", patch(handlers::move_favorite))
}
