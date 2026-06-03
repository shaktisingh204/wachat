//! Mountable router for the §12.8 Ticket endpoints.
//!
//! Mount under `/v1/crm/tickets` from the host `api` crate:
//!
//! ```ignore
//! use crm_tickets;
//! .nest("/v1/crm/tickets", crm_tickets::router::<AppState>())
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
/// Routes (mounted relative — caller nests under `/v1/crm/tickets`):
///
/// ```text
/// GET    /                  — list_tickets
/// POST   /                  — create_ticket
/// GET    /{ticketId}        — get_ticket
/// PATCH  /{ticketId}        — update_ticket
/// DELETE /{ticketId}        — delete_ticket
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
            get(handlers::list_tickets).post(handlers::create_ticket),
        )
        .route(
            "/{ticketId}",
            get(handlers::get_ticket)
                .patch(handlers::update_ticket)
                .delete(handlers::delete_ticket),
        )
}
