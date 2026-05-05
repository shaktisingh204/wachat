//! # wachat-facebook-pages
//!
//! Ports the **Facebook Pages & Profile management** slice of
//! `src/app/actions/facebook.actions.ts` to a Rust BFF surface. The 21
//! handlers in this crate cover OAuth + project setup, page metadata,
//! insights, settings/locations/tabs, the page CTA, page roles, token
//! debug/refresh, and live video CRUD.
//!
//! Mount under `/v1/facebook/pages` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/facebook/pages", wachat_facebook_pages::router::<AppState>())
//! ```
//!
//! ## Auth
//!
//! All handlers extract a [`sabnode_auth::AuthUser`] from the JWT. Project-
//! scoped endpoints additionally call [`handlers::load_project_for`] to
//! confirm the caller owns the target project before any Graph API call —
//! mirroring the `getProjectById()` access check in the TS code.
//!
//! ## Graph API client
//!
//! Outbound Graph API traffic goes through [`wachat_meta_client::MetaClient`].
//! The TS originals call `axios.get/post` with `?access_token=…` query
//! parameters; we instead pass the token via the `Authorization: Bearer`
//! header (which Meta accepts equivalently). For OAuth + `debug_token`
//! endpoints that take an *app token* (not a user token), we call the URL
//! with `&access_token=` as a query parameter and an empty Bearer to skip
//! the auth header — same pattern the TS code uses.

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

pub use state::{FacebookAppConfig, WachatFacebookPagesState};

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFacebookPagesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // OAuth + manual setup
        .route("/setup", post(handlers::handle_facebook_page_setup))
        .route(
            "/oauth-callback",
            post(handlers::handle_facebook_oauth_callback),
        )
        .route(
            "/manual-setup",
            post(handlers::handle_manual_facebook_page_setup),
        )
        // User-level "my pages"
        .route("/", get(handlers::get_facebook_pages))
        // Project-scoped page detail / mutation
        .route("/{project_id}", get(handlers::get_page_details))
        .route(
            "/{project_id}/details",
            post(handlers::handle_update_page_details),
        )
        // Insights
        .route("/{project_id}/insights", get(handlers::get_page_insights))
        .route(
            "/{project_id}/insights/detailed",
            get(handlers::get_detailed_page_insights),
        )
        .route(
            "/{project_id}/insights/demographics",
            get(handlers::get_page_fan_demographics),
        )
        // Settings / locations / tabs / roles
        .route("/{project_id}/settings", get(handlers::get_page_settings))
        .route("/{project_id}/locations", get(handlers::get_page_locations))
        .route("/{project_id}/tabs", get(handlers::get_page_tabs))
        .route("/{project_id}/roles", get(handlers::get_page_roles))
        // Page CTA
        .route(
            "/{project_id}/cta",
            get(handlers::get_page_call_to_action).post(handlers::set_page_call_to_action),
        )
        // Token management
        .route(
            "/{project_id}/token/debug",
            get(handlers::debug_access_token),
        )
        .route(
            "/{project_id}/token/refresh",
            post(handlers::refresh_long_lived_token),
        )
        // Live videos
        .route(
            "/{project_id}/live-videos",
            get(handlers::get_page_live_videos).post(handlers::create_live_video),
        )
        .route(
            "/{project_id}/live-videos/{live_video_id}/end",
            post(handlers::end_live_video),
        )
        .route(
            "/{project_id}/live-videos/{live_video_id}/comments",
            get(handlers::get_live_video_comments),
        )
}
