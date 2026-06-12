//! Mountable routers for the lead-capture Form entity.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/forms`. Behaviour is unchanged.
//! - [`project_router`] — the SabCRM suite surface, scoped by a required
//!   `projectId`. Mount under `/v1/sabcrm/forms`. Also carries the
//!   UNauthenticated public render route `GET /public/{publicId}` (the
//!   form document itself carries its tenant).

use std::sync::Arc;

use axum::{Extension, Router, extract::FromRef, routing::get};
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
        .route("/", get(handlers::list_forms).post(handlers::create_form))
        .route(
            "/{formId}",
            get(handlers::get_form)
                .patch(handlers::update_form)
                .delete(handlers::delete_form),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/forms`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM `projectId`-scoped router — mount under `/v1/sabcrm/forms`.
/// Same handlers, same `crm_forms` collection; every authenticated request
/// must carry `projectId` (query for `GET`/`PATCH`/`DELETE`, body for
/// `POST`) or it is rejected 4xx. `GET /public/{publicId}` is the one
/// unauthenticated route (public form render — sanitised response).
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes()
        .route("/public/{publicId}", get(handlers::public_get_form))
        .layer(Extension(ScopeMode::Project))
}
