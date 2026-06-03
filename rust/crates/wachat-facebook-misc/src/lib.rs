//! # wachat-facebook-misc
//!
//! Ports the residual stub functions in `src/app/actions/facebook.actions.ts`
//! to a Rust BFF surface — subscribed apps + webhook subscription, blocked
//! profiles, status probes (messaging-feature-review and publishing-auth-
//! status), and the `fb_competitors` collection's CRUD + sync flow.
//!
//! Mount under `/v1/facebook/misc` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/facebook/misc", wachat_facebook_misc::router::<AppState>())
//! ```
//!
//! ## Auth
//!
//! Every handler extracts a [`sabnode_auth::AuthUser`] from the JWT.
//! Project-scoped endpoints additionally call [`handlers::load_project_for`]
//! to confirm the caller owns the target project — mirrors the
//! `getProjectById()` access path the TS module invokes at the top of
//! every action.
//!
//! ## Graph API client
//!
//! Outbound Graph API traffic goes through [`wachat_meta_client::MetaClient`].
//! The TS originals call `axios` with `?access_token=…` query parameters;
//! we instead pass the token via the `Authorization: Bearer` header
//! (which Meta accepts equivalently).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatFacebookMiscState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFacebookMiscState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Blocked profiles
        .route("/{project_id}/blocked", get(handlers::get_blocked_profiles))
        // Subscribed apps + webhook subscription
        .route(
            "/{project_id}/subscribed-apps",
            get(handlers::get_subscribed_apps)
                .post(handlers::update_webhook_subscription)
                .delete(handlers::unsubscribe_app),
        )
        // Messaging feature review (`/me/messaging_feature_review`)
        .route(
            "/{project_id}/messaging-feature-review",
            get(handlers::get_messaging_feature_review),
        )
        // Publishing-authorization status
        .route(
            "/{project_id}/publishing-auth-status",
            get(handlers::get_publishing_auth_status),
        )
        // Tracked competitors — list + add (project-scoped)
        .route(
            "/{project_id}/competitors",
            get(handlers::get_tracked_competitors).post(handlers::add_competitor),
        )
        // Single-competitor mutations — keyed by competitor id, not project.
        .route(
            "/competitors/{competitor_id}",
            delete(handlers::remove_competitor),
        )
        .route(
            "/competitors/{competitor_id}/sync",
            post(handlers::sync_competitor_data),
        )
}
