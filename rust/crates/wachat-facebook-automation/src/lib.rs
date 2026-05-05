//! # wachat-facebook-automation
//!
//! Axum router porting the **Broadcasts, Automation & Scheduling** slice
//! of `src/app/actions/facebook.actions.ts`. Mounts under
//! `/v1/facebook/automation` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/facebook/automation", wachat_facebook_automation::router::<AppState>())
//! ```
//!
//! ## Endpoints
//!
//! ```text
//! POST   /projects/{project_id}/automation                 — handleUpdateFacebookAutomationSettings
//! POST   /projects/{project_id}/randomizer/settings        — saveRandomizerSettings
//! GET    /projects/{project_id}/randomizer/posts           — getRandomizerPosts
//! POST   /projects/{project_id}/randomizer/posts           — addRandomizerPost
//! DELETE /projects/{project_id}/randomizer/posts/{post_id} — deleteRandomizerPost
//! GET    /projects/{project_id}/broadcasts                 — getFacebookBroadcasts
//! POST   /projects/{project_id}/broadcasts                 — handleSendFacebookBroadcast
//! GET    /projects/{project_id}/live-streams               — getScheduledLiveStreams
//! POST   /projects/{project_id}/live-streams               — handleScheduleLiveStream (multipart)
//! ```
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the `AuthUser` extractor — there is no
//! anonymous access. Per-project endpoints additionally enforce
//! `user.tenant_id == project.userId.to_hex()` after loading the project
//! via the inline `load_project_for` helper. The TS source returned soft
//! `OkResult { success, error }` envelopes for some failures; we keep
//! that wire shape so the existing form-action call sites that pattern
//! match on `.error` keep working.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need only:
//!
//! - a [`WachatFacebookAutomationState`] bundle (Mongo handle + shared
//!   `MetaClient` + a private upload `reqwest::Client`), and
//! - an `Arc<sabnode_auth::AuthConfig>` for the JWT verifier.
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::{DefaultBodyLimit, FromRef},
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatFacebookAutomationState;

/// 256 MiB cap on the multipart `live-streams` upload. Live videos are
/// bigger than the default 2 MiB axum limit; we lift it here rather
/// than globally so the rest of the API stays bounded.
const LIVE_STREAM_BODY_LIMIT: usize = 256 * 1024 * 1024;

/// Build the Facebook automation router.
///
/// Routes are written **relative**. The caller (the `api` crate) nests
/// the result under `/v1/facebook/automation`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFacebookAutomationState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- automation settings ----------------------------------------
        .route(
            "/projects/{project_id}/automation",
            post(handlers::update_automation_settings),
        )
        // ---- post randomizer --------------------------------------------
        .route(
            "/projects/{project_id}/randomizer/settings",
            post(handlers::save_randomizer_settings),
        )
        .route(
            "/projects/{project_id}/randomizer/posts",
            get(handlers::list_randomizer_posts).post(handlers::add_randomizer_post),
        )
        .route(
            "/projects/{project_id}/randomizer/posts/{post_id}",
            delete(handlers::delete_randomizer_post),
        )
        // ---- broadcasts -------------------------------------------------
        .route(
            "/projects/{project_id}/broadcasts",
            get(handlers::list_facebook_broadcasts).post(handlers::send_facebook_broadcast),
        )
        // ---- live streams ----------------------------------------------
        .route(
            "/projects/{project_id}/live-streams",
            get(handlers::list_scheduled_live_streams)
                .post(handlers::schedule_live_stream)
                .layer(DefaultBodyLimit::max(LIVE_STREAM_BODY_LIMIT)),
        )
}
