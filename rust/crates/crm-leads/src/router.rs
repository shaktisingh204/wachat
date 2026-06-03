//! Mountable router for the §5.1 Lead endpoints.
//!
//! Mount under `/v1/crm/leads` from the host `api` crate:
//!
//! ```ignore
//! use crm_leads;
//! .nest("/v1/crm/leads", crm_leads::router::<AppState>())
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
/// Routes (mounted relative — caller nests under `/v1/crm/leads`):
///
/// ```text
/// GET    /                  — list_leads
/// POST   /                  — create_lead
/// GET    /{leadId}          — get_lead
/// PATCH  /{leadId}          — update_lead
/// DELETE /{leadId}          — delete_lead
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
        .route("/", get(handlers::list_leads).post(handlers::create_lead))
        .route(
            "/{leadId}",
            get(handlers::get_lead)
                .patch(handlers::update_lead)
                .delete(handlers::delete_lead),
        )
}
