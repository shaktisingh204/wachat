//! Mountable routers for the Form Submission entity.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/form-submissions`. Behaviour is unchanged.
//! - [`project_router`] — the SabCRM suite surface, scoped by a required
//!   `projectId`. Mount under `/v1/sabcrm/form-submissions`. Also carries
//!   the UNauthenticated public submit route
//!   `POST /public/{publicId}` (the form document carries its tenant).

use std::sync::Arc;

use axum::{Extension, Router, extract::FromRef, routing::get, routing::post};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// The shared CRUD route table (no scope attached yet).
fn crud_routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_submissions).post(handlers::create_submission),
        )
        .route(
            "/{submissionId}",
            get(handlers::get_submission)
                .patch(handlers::update_submission)
                .delete(handlers::delete_submission),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/form-submissions`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM `projectId`-scoped router — mount under
/// `/v1/sabcrm/form-submissions`. Same handlers, same
/// `crm_form_submissions` collection; every authenticated request must
/// carry `projectId` (query for `GET`/`PATCH`/`DELETE`, body for `POST`)
/// or it is rejected 4xx. `POST /public/{publicId}` is the one
/// unauthenticated route (public form submission — the form carries its
/// tenant).
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes()
        .route("/public/{publicId}", post(handlers::public_submit))
        .layer(Extension(ScopeMode::Project))
}
