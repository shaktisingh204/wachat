//! Mountable router for the §6.3 Contact endpoints.
//!
//! Mount under `/v1/crm/contacts` from the host `api` crate:
//!
//! ```ignore
//! use crm_contacts;
//! .nest("/v1/crm/contacts", crm_contacts::router::<AppState>())
//! ```

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router. State must expose `MongoHandle` + `Arc<AuthConfig>`
/// via `FromRef` (the standard `AppState` already does).
///
/// Routes (relative — caller nests under `/v1/crm/contacts`):
///
/// ```text
/// GET    /              — list_contacts
/// POST   /              — create_contact
/// GET    /{contactId}   — get_contact
/// PATCH  /{contactId}   — update_contact
/// DELETE /{contactId}   — delete_contact (soft → status: archived)
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_contacts).post(handlers::create_contact),
        )
        .route(
            "/{contactId}",
            get(handlers::get_contact)
                .patch(handlers::update_contact)
                .delete(handlers::delete_contact),
        )
}
