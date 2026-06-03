//! Mountable router for the §1.8 Credit Note endpoints.
//!
//! Mount under `/v1/crm/credit-notes` from the host `api` crate:
//!
//! ```ignore
//! use crm_credit_notes;
//! .nest("/v1/crm/credit-notes", crm_credit_notes::router::<AppState>())
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
/// Routes (mounted relative — caller nests under `/v1/crm/credit-notes`):
///
/// ```text
/// GET    /                  — list_credit_notes
/// POST   /                  — create_credit_note
/// GET    /{cnId}            — get_credit_note
/// PATCH  /{cnId}            — update_credit_note
/// DELETE /{cnId}            — delete_credit_note
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
        .route(
            "/",
            get(handlers::list_credit_notes).post(handlers::create_credit_note),
        )
        .route(
            "/{cnId}",
            get(handlers::get_credit_note)
                .patch(handlers::update_credit_note)
                .delete(handlers::delete_credit_note),
        )
}
