//! Mountable routers for the §2.4 Debit Note endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/debit-notes`. Behaviour is unchanged.
//! - [`project_router`] — the SabCRM Finance suite surface, scoped by a
//!   required `projectId`. Mount under
//!   `/v1/sabcrm/finance/debit-notes`.
//!
//! ```ignore
//! use crm_debit_notes;
//! .nest("/v1/crm/debit-notes", crm_debit_notes::router::<AppState>())
//! .nest("/v1/sabcrm/finance/debit-notes", crm_debit_notes::project_router::<AppState>())
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
/// GET    /                    — list_debit_notes
/// POST   /                    — create_debit_note
/// GET    /{debitNoteId}       — get_debit_note
/// PATCH  /{debitNoteId}       — update_debit_note
/// DELETE /{debitNoteId}       — delete_debit_note
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
            get(handlers::list_debit_notes).post(handlers::create_debit_note),
        )
        .route(
            "/{debitNoteId}",
            get(handlers::get_debit_note)
                .patch(handlers::update_debit_note)
                .delete(handlers::delete_debit_note),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/debit-notes`.
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
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Finance `projectId`-scoped router — mount under
/// `/v1/sabcrm/finance/debit-notes`. Same handlers, same
/// `crm_debit_notes` collection; every request must carry `projectId`
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
