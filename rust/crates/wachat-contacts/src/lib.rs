//! # wachat-contacts
//!
//! Phase — axum router that ports the contact CRUD work currently done
//! in `src/app/actions/contact.actions.ts`. Mounted under
//! `/v1/contacts` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/contacts", wachat_contacts::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! All seven server actions in `contact.actions.ts` map to a single
//! HTTP route here. The router is a thin orchestration layer:
//! validation → tenancy guard → Mongo I/O. There is no business logic
//! beyond what the legacy TS already did.
//!
//! | TS action                       | HTTP route                          |
//! |---------------------------------|-------------------------------------|
//! | `handleAddNewContact`           | `POST   /`                          |
//! | `getContactsPageData`           | `GET    /?projectId=&...`           |
//! | `handleImportContacts`          | `POST   /import`                    |
//! | `handleUpdateContactDetails`    | `PATCH  /{id}`                      |
//! | `handleUpdateContactStatus`     | `PATCH  /{id}/status`               |
//! | `updateContactTags`             | `PATCH  /{id}/tags`                 |
//! | `deleteContact`                 | `DELETE /{id}`                      |
//!
//! ## What we deliberately offload to the TS shim
//!
//! `handleImportContacts` accepted a multipart `File` and ran
//! `papaparse` server-side. JSON-over-HTTP is the wrong transport for
//! that, and the existing TS code already knows how to parse CSV /
//! XLSX. So the migration leaves CSV parsing in the TS shim and accepts
//! a normalised JSON payload here (`contacts: Array<{ phone, name,
//! ...variables }>`). Every other piece of logic — validation,
//! tenancy, persistence — lives in Rust.
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. The project-scoped mutations
//! (`add_contact`, `delete_contact`) additionally enforce the legacy
//! **owner-or-agent** project guard — the user must either own the
//! project or appear in its `agents` array. The **import** endpoint
//! enforces the stricter ownership check the TS code did
//! (`project.userId.toString() === session.user._id`).
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`WachatContactsState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{patch, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatContactsState;

/// Build the wachat contacts router.
///
/// Routes (mounted relative — caller nests under `/v1/contacts`):
///
/// ```text
/// POST   /                          — add_contact
/// GET    /                          — list_contacts
/// POST   /import                    — import_contacts
/// PATCH  /{id}                      — update_contact_details
/// PATCH  /{id}/status               — update_contact_status
/// PATCH  /{id}/tags                 — update_contact_tags
/// DELETE /{id}                      — delete_contact
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`WachatContactsState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Route ordering note:** the literal `/import` segment is registered
/// before the `/{id}` patterns so axum's matcher prefers the literal
/// over the `{id}` parameter.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatContactsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- literal segment first ------------------------------------
        .route("/import", post(handlers::import_contacts))
        // ---- collection root ------------------------------------------
        .route(
            "/",
            post(handlers::add_contact).get(handlers::list_contacts),
        )
        // ---- per-contact endpoints ------------------------------------
        .route(
            "/{id}",
            patch(handlers::update_contact_details).delete(handlers::delete_contact),
        )
        .route("/{id}/status", patch(handlers::update_contact_status))
        .route("/{id}/tags", patch(handlers::update_contact_tags))
}
