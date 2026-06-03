//! Mountable router for the §12.13 Fixed Asset endpoints.
//!
//! Mount under `/v1/crm/fixed-assets` from the host `api` crate:
//!
//! ```ignore
//! use crm_fixed_assets;
//! .nest("/v1/crm/fixed-assets", crm_fixed_assets::router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get, routing::post};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router.
///
/// Routes (mounted relative — caller nests under `/v1/crm/fixed-assets`):
///
/// ```text
/// GET    /                         — list_assets
/// POST   /                         — create_asset
/// GET    /{assetId}                — get_asset
/// PATCH  /{assetId}                — update_asset
/// DELETE /{assetId}                — delete_asset
/// POST   /{assetId}/depreciate     — depreciate_asset
/// ```
///
/// `S` is the caller's outer application state. Handlers need a
/// [`MongoHandle`] (data access) and `Arc<AuthConfig>` (the JWT
/// verifier the `AuthUser` extractor reads). Both are pulled via
/// [`FromRef`] so this crate stays decoupled from the orchestrator's
/// concrete `AppState`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_assets).post(handlers::create_asset))
        .route(
            "/{assetId}",
            get(handlers::get_asset)
                .patch(handlers::update_asset)
                .delete(handlers::delete_asset),
        )
        .route("/{assetId}/depreciate", post(handlers::depreciate_asset))
}
