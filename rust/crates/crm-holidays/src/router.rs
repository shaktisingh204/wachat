//! Mountable router for the §9.5 Holiday endpoints.
//!
//! Mount under `/v1/crm/holidays` from the host `api` crate:
//!
//! ```ignore
//! use crm_holidays;
//! .nest("/v1/crm/holidays", crm_holidays::router::<AppState>())
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
/// Routes (mounted relative — caller nests under `/v1/crm/holidays`):
///
/// ```text
/// GET    /                  — list_holidays
/// POST   /                  — create_holiday
/// GET    /{holidayId}       — get_holiday
/// PATCH  /{holidayId}       — update_holiday
/// DELETE /{holidayId}       — delete_holiday
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
            get(handlers::list_holidays).post(handlers::create_holiday),
        )
        .route(
            "/{holidayId}",
            get(handlers::get_holiday)
                .patch(handlers::update_holiday)
                .delete(handlers::delete_holiday),
        )
}
