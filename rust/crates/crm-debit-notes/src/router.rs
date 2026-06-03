//! Mountable router for the §2.4 Debit Note endpoints.
//!
//! Mount under `/v1/crm/debit-notes` from the host `api` crate:
//!
//! ```ignore
//! use crm_debit_notes;
//! .nest("/v1/crm/debit-notes", crm_debit_notes::router::<AppState>())
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
/// Routes (mounted relative — caller nests under `/v1/crm/debit-notes`):
///
/// ```text
/// GET    /                    — list_debit_notes
/// POST   /                    — create_debit_note
/// GET    /{debitNoteId}       — get_debit_note
/// PATCH  /{debitNoteId}       — update_debit_note
/// DELETE /{debitNoteId}       — delete_debit_note
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
            get(handlers::list_debit_notes).post(handlers::create_debit_note),
        )
        .route(
            "/{debitNoteId}",
            get(handlers::get_debit_note)
                .patch(handlers::update_debit_note)
                .delete(handlers::delete_debit_note),
        )
}
