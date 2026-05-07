//! Mountable router for the §12.12 Booking + BookingResource endpoints.
//!
//! Mount under `/v1/crm/bookings` from the host `api` crate:
//!
//! ```ignore
//! use crm_bookings;
//! .nest("/v1/crm/bookings", crm_bookings::router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router.
///
/// Routes (mounted relative — caller nests under `/v1/crm/bookings`):
///
/// ```text
/// GET    /resources              — list_resources
/// POST   /resources              — create_resource
/// GET    /resources/{id}         — get_resource
/// PATCH  /resources/{id}         — update_resource
/// DELETE /resources/{id}         — delete_resource
///
/// GET    /bookings               — list_bookings
/// POST   /bookings               — create_booking
/// GET    /bookings/{id}          — get_booking
/// PATCH  /bookings/{id}          — update_booking
/// DELETE /bookings/{id}          — delete_booking
/// POST   /bookings/{id}/check-in — check_in_booking
/// POST   /bookings/{id}/cancel   — cancel_booking
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
        // ----- BookingResource -----
        .route(
            "/resources",
            get(handlers::list_resources).post(handlers::create_resource),
        )
        .route(
            "/resources/{id}",
            get(handlers::get_resource)
                .patch(handlers::update_resource)
                .delete(handlers::delete_resource),
        )
        // ----- Booking -----
        .route(
            "/bookings",
            get(handlers::list_bookings).post(handlers::create_booking),
        )
        .route(
            "/bookings/{id}",
            get(handlers::get_booking)
                .patch(handlers::update_booking)
                .delete(handlers::delete_booking),
        )
        .route("/bookings/{id}/check-in", post(handlers::check_in_booking))
        .route("/bookings/{id}/cancel", post(handlers::cancel_booking))
}
