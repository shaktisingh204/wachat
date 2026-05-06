//! # wachat-facebook-events
//!
//! Ports the **Facebook Page Events** slice of
//! `src/app/actions/facebook.actions.ts` to a Rust BFF surface. The 6
//! handlers in this crate cover event listing, single-event detail,
//! create, update, delete, and attendee enumeration by RSVP status.
//!
//! Mount under `/v1/facebook/events` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/facebook/events", wachat_facebook_events::router::<AppState>())
//! ```
//!
//! ## Auth
//!
//! All handlers extract a [`sabnode_auth::AuthUser`] from the JWT and call
//! [`handlers::load_project_for`] to confirm the caller owns the target
//! project before issuing any Graph API call — mirroring the
//! `getProjectById()` access check the TS code performs at the top of
//! every event action.
//!
//! ## Graph API client
//!
//! Outbound Graph API traffic goes through [`wachat_meta_client::MetaClient`].
//! The TS originals call `axios.get/post/delete` with `?access_token=…`
//! query parameters; we instead pass the token via the `Authorization:
//! Bearer` header (which Meta accepts equivalently).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;

pub use state::WachatFacebookEventsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFacebookEventsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // List + create on the page collection
        .route(
            "/{project_id}",
            get(handlers::get_facebook_events).post(handlers::handle_create_facebook_event),
        )
        // Single event GET / UPDATE / DELETE
        .route(
            "/{project_id}/{event_id}",
            get(handlers::get_event_details)
                .post(handlers::handle_update_facebook_event)
                .delete(handlers::delete_facebook_event),
        )
        // Attendees: default RSVP via query string,
        .route(
            "/{project_id}/{event_id}/attendees",
            get(handlers::get_event_attendees_default),
        )
        // …or explicit RSVP via path segment (`attending|maybe|declined`).
        .route(
            "/{project_id}/{event_id}/attendees/{rsvp_status}",
            get(handlers::get_event_attendees),
        )
}
