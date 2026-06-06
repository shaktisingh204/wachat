//! # wachat-ab-testing
//!
//! Axum router for the `/wachat/campaign-ab-test` page: split-test
//! broadcast campaigns. Persists the test configuration plus a
//! per-test results document; the actual split broadcast is launched
//! Next-side (via `rustClient.wachatBroadcast.bulkStart`) and a webhook
//! later populates the results doc. Mounted under `/v1/wachat/ab-tests`:
//!
//! ```ignore
//! .nest("/v1/wachat/ab-tests", wachat_ab_testing::router::<AppState>())
//! ```
//!
//! Every query is scoped to the authenticated user (`userId`) and the
//! owning project (`projectId`). Generic over the caller's state `S`;
//! needs a [`WachatAbTestingState`] and the JWT verifier config, both
//! pulled via [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatAbTestingState;

/// Build the ab-testing router (caller nests under `/v1/wachat/ab-tests`).
///
/// ```text
/// GET    /                      — list_tests (?projectId=)
/// POST   /                      — create_test (create + launch)
/// GET    /{id}                  — get_test (detail + per-variant results)
/// DELETE /{id}                  — delete_test
/// POST   /{id}/stop             — stop_test
/// POST   /{id}/promote-winner   — promote_winner
/// ```
///
/// Routes with literal segments after the `{id}` param (`/{id}/stop`,
/// `/{id}/promote-winner`) are registered alongside the bare `/{id}`
/// route — axum 0.8 matches the more specific path first.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatAbTestingState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_tests).post(handlers::create_test))
        .route(
            "/{id}",
            get(handlers::get_test).delete(handlers::delete_test),
        )
        .route("/{id}/stop", post(handlers::stop_test))
        .route("/{id}/promote-winner", post(handlers::promote_winner))
}
