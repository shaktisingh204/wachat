//! Mountable routers for the PayrollSetting entity.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/payroll-settings`. Behaviour is unchanged (list/create/
//!   CRUD), plus the additive `PUT /` singleton upsert.
//! - [`project_router`] — the SabCRM People suite surface, scoped by a
//!   required `projectId`. Mount under
//!   `/v1/sabcrm/people/payroll-settings`. Payroll settings are
//!   **singleton-per-scope** there (people-suite WI-14): `GET /`
//!   returns the scope's single document (or `null`), `PUT /` upserts.
//!   There is deliberately no `POST /` on the project mount — that
//!   would allow multiple settings documents per scope.
//!
//! ```ignore
//! use crm_payroll_settings;
//! .nest("/v1/crm/payroll-settings", crm_payroll_settings::router::<AppState>())
//! .nest("/v1/sabcrm/people/payroll-settings", crm_payroll_settings::project_router::<AppState>())
//! ```

use std::sync::Arc;

use axum::{Extension, Router, extract::FromRef, routing::get};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// The shared by-id route table (no scope attached yet).
fn id_routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route(
        "/{settingId}",
        get(handlers::get_setting)
            .patch(handlers::update_setting)
            .delete(handlers::delete_setting),
    )
}

/// Legacy `userId`-scoped router — mount under
/// `/v1/crm/payroll-settings`. `GET /` stays the historical paginated
/// list (behaviour freeze); `PUT /` is the additive singleton upsert.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    id_routes()
        .route(
            "/",
            get(handlers::list_settings)
                .post(handlers::create_setting)
                .put(handlers::upsert_setting),
        )
        .layer(Extension(ScopeMode::User))
}

/// SabCRM People `projectId`-scoped router — mount under
/// `/v1/sabcrm/people/payroll-settings`. Same handlers, same
/// `crm_payroll_settings` collection; every request must carry
/// `projectId` (query for `GET`/`PATCH`/`DELETE`, body for `PUT`) or it
/// is rejected 4xx. Singleton-per-scope: `GET /` → single doc,
/// `PUT /` → upsert (people-suite WI-14).
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    id_routes()
        .route(
            "/",
            get(handlers::get_singleton_setting).put(handlers::upsert_setting),
        )
        .layer(Extension(ScopeMode::Project))
}
