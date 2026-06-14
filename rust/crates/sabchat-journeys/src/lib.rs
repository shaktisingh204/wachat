//! # sabchat-journeys
//!
//! Axum router that owns the **outbound journeys** HTTP surface for
//! SabChat. Mounted under `/v1/sabchat/journeys` from the orchestrating
//! `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/journeys", sabchat_journeys::router::<AppState>())
//! ```
//!
//! ## Model
//!
//! A **journey** is an ordered list of steps; a **run** is one contact's
//! position in a journey. Contacts are enrolled by id or by tag segment.
//! The cron-callable [`tick`](handlers::tick) advances every due run by
//! one step:
//!
//! * `wait`    — defer `next_run_at` by N minutes.
//! * `message` — enqueue a row onto `sabchat_journey_outbox` (the channel
//!   dispatcher drains it) and advance.
//! * `goal` / end-of-steps — complete the run.
//!
//! Keeping delivery behind the outbox makes this crate a pure
//! orchestration state machine — no channel/transport coupling.
//!
//! ## Routes
//!
//! | Method  | Path                       | Handler            |
//! |---------|----------------------------|--------------------|
//! | `POST`  | `/journeys`                | `create_journey`   |
//! | `GET`   | `/journeys`                | `list_journeys`    |
//! | `GET`   | `/journeys/{id}`           | `get_journey`      |
//! | `PATCH` | `/journeys/{id}`           | `update_journey`   |
//! | `DELETE`| `/journeys/{id}`           | `delete_journey`   |
//! | `POST`  | `/journeys/{id}/enroll`    | `enroll`           |
//! | `POST`  | `/tick`                    | `tick` (cron)      |
//! | `GET`   | `/outbox`                  | `list_outbox`      |
//! | `POST`  | `/outbox/{id}/sent`        | `mark_outbox_sent` |
//!
//! Every endpoint requires [`AuthUser`](sabnode_auth::AuthUser) and
//! filters all I/O on the JWT tenant claim.

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

pub use state::SabChatJourneysState;

/// Re-export of the shared tick body for a cron worker that has already
/// resolved the tenant out-of-band.
pub use handlers::tick_tenant;

/// Build the sabchat journeys router (mounted relative under
/// `/v1/sabchat/journeys`).
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatJourneysState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/tick", post(handlers::tick))
        .route("/outbox", get(handlers::list_outbox))
        .route("/outbox/{id}/sent", post(handlers::mark_outbox_sent))
        .route("/outbox/{id}/skip", post(handlers::mark_outbox_skipped))
        .route(
            "/journeys",
            post(handlers::create_journey).get(handlers::list_journeys),
        )
        .route(
            "/journeys/{id}",
            get(handlers::get_journey)
                .patch(handlers::update_journey)
                .delete(handlers::delete_journey),
        )
        .route("/journeys/{id}/enroll", post(handlers::enroll))
}
