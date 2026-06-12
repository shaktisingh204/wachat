//! Mountable routers for the §1.8 Credit Note endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/credit-notes`. Behaviour is unchanged.
//! - [`project_router`] — the SabCRM Finance suite surface, scoped by a
//!   required `projectId`. Mount under
//!   `/v1/sabcrm/finance/credit-notes`.
//!
//! ```ignore
//! use crm_credit_notes;
//! .nest("/v1/crm/credit-notes", crm_credit_notes::router::<AppState>())
//! .nest("/v1/sabcrm/finance/credit-notes", crm_credit_notes::project_router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{Extension, Router, extract::FromRef, routing::get};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// The shared CRUD route table (no scope attached yet).
///
/// ```text
/// GET    /                  — list_credit_notes
/// POST   /                  — create_credit_note
/// GET    /{cnId}            — get_credit_note
/// PATCH  /{cnId}            — update_credit_note
/// DELETE /{cnId}            — delete_credit_note
/// ```
fn crud_routes<S>() -> Router<S>
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

/// Legacy `userId`-scoped router — mount under `/v1/crm/credit-notes`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Finance `projectId`-scoped router — mount under
/// `/v1/sabcrm/finance/credit-notes`. Same handlers, same
/// `crm_credit_notes` collection; every request must carry `projectId`
/// (query for `GET`/`PATCH`/`DELETE`, body for `POST`) or it is
/// rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
