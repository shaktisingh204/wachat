//! Axum router for the SabCRM settings HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/settings", sabcrm_settings::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/settings`):
//!
//! ```text
//! GET    /    — get_settings
//! PUT    /    — update_settings
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

/// Build the SabCRM settings router. See module docs for the route table
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
            get(handlers::get_settings).put(handlers::update_settings),
        )
        // Typed per-domain sections — strongly-typed, validated views over the
        // same per-project document (`data.<section>`).
        .route(
            "/general",
            get(handlers::get_general).put(handlers::put_general),
        )
        .route(
            "/appearance",
            get(handlers::get_appearance).put(handlers::put_appearance),
        )
        .route(
            "/notifications",
            get(handlers::get_notifications).put(handlers::put_notifications),
        )
        .route(
            "/localization",
            get(handlers::get_localization).put(handlers::put_localization),
        )
        .route("/lab", get(handlers::get_lab).put(handlers::put_lab))
        .route(
            "/security",
            get(handlers::get_security).put(handlers::put_security),
        )
}
