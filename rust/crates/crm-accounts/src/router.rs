//! Mountable router for the §6.2 Account endpoints.
//!
//! Mount under `/v1/crm/accounts` from the host `api` crate:
//!
//! ```ignore
//! use crm_accounts;
//! .nest("/v1/crm/accounts", crm_accounts::router::<AppState>())
//! ```

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router. State must expose `MongoHandle` + `Arc<AuthConfig>`
/// via `FromRef` (the standard `AppState` already does).
///
/// Routes (relative — caller nests under `/v1/crm/accounts`):
///
/// ```text
/// GET    /              — list_accounts
/// POST   /              — create_account
/// GET    /{accountId}   — get_account
/// PATCH  /{accountId}   — update_account
/// DELETE /{accountId}   — delete_account (soft → status: archived)
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
            get(handlers::list_accounts).post(handlers::create_account),
        )
        .route(
            "/{accountId}",
            get(handlers::get_account)
                .patch(handlers::update_account)
                .delete(handlers::delete_account),
        )
}
