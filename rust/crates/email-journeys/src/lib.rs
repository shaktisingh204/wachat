//! # email-journeys
//!
//! HTTP surface for the SabNode email **journeys** domain.
//!
//! Owns CRUD + lifecycle (`draft → active → paused → archived`),
//! per-run observability, report rollups, manual enrolment, and a
//! prebuilt-template catalogue. Manual enrol writes a `journey-tick`
//! job onto the BullMQ `"email-journey"` queue drained by
//! [`email-journey-worker`](https://docs.rs/email-journey-worker).
//!
//! Mounted relative — the orchestrating `api` crate nests this under
//! `/v1/email/journeys`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub mod dto;
pub mod handlers;
pub mod state;
pub mod templates;

pub use state::EmailJourneysState;

/// Build the journeys router.
///
/// Routes (mounted relative — caller nests under `/v1/email/journeys`):
///
/// ```text
/// GET    /                            — list (filter: status, triggerKind)
/// POST   /                            — create draft journey
/// GET    /templates                   — list prebuilt journey templates
/// GET    /{id}                        — get one
/// PATCH  /{id}                        — update nodes/edges/trigger/name/description
/// DELETE /{id}                        — hard delete (draft only) / archive
/// POST   /{id}/activate               — validate + status → active
/// POST   /{id}/pause                  — status → paused
/// POST   /{id}/clone                  — duplicate as a new draft
/// POST   /{id}/enroll                 — manually enrol one subscriber
/// GET    /{id}/runs                   — paginated runs (filter: status)
/// GET    /{id}/runs/{runId}           — single run + history
/// GET    /{id}/report                 — counts + per-node decision breakdown
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    EmailJourneysState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Collection root + templates literal (must precede `/{id}`).
        .route(
            "/",
            get(handlers::list_journeys).post(handlers::create_journey),
        )
        .route("/templates", get(handlers::list_templates))
        // Per-id literal sub-paths.
        .route("/{id}/activate", post(handlers::activate_journey))
        .route("/{id}/pause", post(handlers::pause_journey))
        .route("/{id}/clone", post(handlers::clone_journey))
        .route("/{id}/enroll", post(handlers::enroll_subscriber))
        .route("/{id}/runs", get(handlers::list_runs))
        .route("/{id}/runs/{run_id}", get(handlers::get_run))
        .route("/{id}/report", get(handlers::report))
        // Per-id CRUD.
        .route(
            "/{id}",
            get(handlers::get_journey)
                .patch(handlers::update_journey)
                .delete(handlers::delete_journey),
        )
}
