//! Mountable routers for the Salary Structure entity.
//!
//! Unlike the other People-suite crates, the two mounts here serve
//! **different document shapes** over the same `crm_salary_structures`
//! collection (people-suite §2.1.2 — the schema-collision fix):
//!
//! - [`router`] — the legacy `userId`-scoped FLAT surface
//!   ([`crate::types::CrmSalaryStructure`]: `employeeId`, `basic`,
//!   `hra`, …). Mount under `/v1/crm/salary-structures`. Behaviour is
//!   unchanged — these handlers were deliberately left untouched.
//! - [`project_router`] — the SabCRM People suite surface CRUDing the
//!   **canonical rich** `hrm_payroll_types::SalaryStructure` (`name`,
//!   `effectiveDate`, `components[]`, `applicableTo[]`, `active`) that
//!   payroll compute consumes. Mount under
//!   `/v1/sabcrm/people/salary-structures`; every request must carry
//!   `projectId` (query for `GET`/`PATCH`/`DELETE`, body for `POST`)
//!   or it is rejected 4xx.
//!
//! ```ignore
//! use crm_salary_structures;
//! .nest("/v1/crm/salary-structures", crm_salary_structures::router::<AppState>())
//! .nest("/v1/sabcrm/people/salary-structures", crm_salary_structures::project_router::<AppState>())
//! ```

use std::sync::Arc;

use axum::{Extension, Router, extract::FromRef, routing::get};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::{handlers, rich};

/// Legacy `userId`-scoped FLAT router — mount under
/// `/v1/crm/salary-structures`. Untouched behaviour (people-suite
/// §2.1.2: the flat CRUD stays only on this mount).
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_structures).post(handlers::create_structure),
        )
        .route(
            "/{structureId}",
            get(handlers::get_structure)
                .patch(handlers::update_structure)
                .delete(handlers::delete_structure),
        )
}

/// SabCRM People `projectId`-scoped RICH router — mount under
/// `/v1/sabcrm/people/salary-structures`. CRUDs the canonical
/// `hrm_payroll_types::SalaryStructure` shape (see [`crate::rich`]);
/// every request must carry `projectId` or it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(rich::list_rich_structures).post(rich::create_rich_structure),
        )
        .route(
            "/{structureId}",
            get(rich::get_rich_structure)
                .patch(rich::update_rich_structure)
                .delete(rich::delete_rich_structure),
        )
        .layer(Extension(ScopeMode::Project))
}
