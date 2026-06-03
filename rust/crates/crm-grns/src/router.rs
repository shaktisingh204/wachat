//! Mountable router for the §12.4 GRN endpoints.
//!
//! Mount under `/v1/crm/grns` from the host `api` crate:
//!
//! ```ignore
//! use crm_grns;
//! .nest("/v1/crm/grns", crm_grns::router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router.
///
/// Routes (mounted relative — caller nests under `/v1/crm/grns`):
///
/// ```text
/// GET    /                  — list_grns
/// POST   /                  — create_grn
/// GET    /{grnId}           — get_grn
/// PATCH  /{grnId}           — update_grn
/// DELETE /{grnId}           — delete_grn
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
        .route("/", get(handlers::list_grns).post(handlers::create_grn))
        .route(
            "/{grnId}",
            get(handlers::get_grn)
                .patch(handlers::update_grn)
                .delete(handlers::delete_grn),
        )
}
