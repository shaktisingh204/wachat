//! # wachat-facebook-messenger-profile
//!
//! Ports the **Messenger Profile / Personas / Saved Responses** slice of
//! `src/app/actions/facebook.actions.ts` to a Rust BFF surface. The 15
//! handlers in this crate cover:
//!
//! * Messenger Profile fields — `getMessengerProfile`, `setMessengerGreeting`,
//!   `setMessengerGetStarted`, `setMessengerIceBreakers`,
//!   `setWhitelistedDomains`, `deleteMessengerProfileFields`, and
//!   `savePersistentMenu`.
//! * Personas — `getPersonas`, `createPersona`, `deletePersona`.
//! * Saved Responses — `getSavedResponses`, `createSavedResponse`,
//!   `updateSavedResponse`, `deleteSavedResponse`.
//! * Reusable message attachments — `uploadReusableAttachment` (URL form;
//!   the multipart binary upload variant stays in the TS shim).
//!
//! Mount under `/v1/facebook/messenger-profile` from the `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/facebook/messenger-profile",
//!     wachat_facebook_messenger_profile::router::<AppState>(),
//! )
//! ```
//!
//! ## Auth
//!
//! All handlers extract a [`sabnode_auth::AuthUser`] from the JWT and call
//! [`handlers::load_project_for`] to confirm the caller owns the target
//! project before any Graph API call — mirroring the `getProjectById()`
//! access check in the TS code.
//!
//! ## Graph API client
//!
//! Outbound Graph API traffic goes through [`wachat_meta_client::MetaClient`].
//! The TS originals call `axios.get/post/delete` with `?access_token=…`
//! query parameters; we instead pass the token via the
//! `Authorization: Bearer` header (Meta accepts both equivalently).

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

pub use state::WachatFacebookMessengerProfileState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFacebookMessengerProfileState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Messenger Profile fields
        .route(
            "/{project_id}/profile",
            get(handlers::get_messenger_profile).delete(handlers::delete_messenger_profile_fields),
        )
        .route(
            "/{project_id}/profile/greeting",
            post(handlers::set_messenger_greeting),
        )
        .route(
            "/{project_id}/profile/get-started",
            post(handlers::set_messenger_get_started),
        )
        .route(
            "/{project_id}/profile/ice-breakers",
            post(handlers::set_messenger_ice_breakers),
        )
        .route(
            "/{project_id}/profile/whitelisted-domains",
            post(handlers::set_whitelisted_domains),
        )
        .route(
            "/{project_id}/profile/persistent-menu",
            post(handlers::save_persistent_menu),
        )
        // Personas
        .route(
            "/{project_id}/personas",
            get(handlers::get_personas).post(handlers::create_persona),
        )
        .route(
            "/{project_id}/personas/{persona_id}",
            delete(handlers::delete_persona),
        )
        // Saved Responses
        .route(
            "/{project_id}/saved-responses",
            get(handlers::get_saved_responses).post(handlers::create_saved_response),
        )
        .route(
            "/{project_id}/saved-responses/{response_id}",
            post(handlers::update_saved_response).delete(handlers::delete_saved_response),
        )
        // Reusable attachments
        .route(
            "/{project_id}/attachments",
            post(handlers::upload_reusable_attachment),
        )
}
