//! # sabchat-contacts
//!
//! Phase — axum router for SabChat's deduped cross-channel **contact**
//! identity. One human → one `sabchat_contacts` document, where phones,
//! emails, and social ids are arrays so the same person reaching us via
//! widget + WhatsApp + Instagram folds into a single record.
//!
//! Mounted under `/v1/sabchat/contacts` from the orchestrating `api`
//! crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/contacts", sabchat_contacts::router::<AppState>())
//! ```
//!
//! ## Routes
//!
//! | Method | Path              | Handler            |
//! |--------|-------------------|--------------------|
//! | POST   | `/`               | `create_contact`   |
//! | GET    | `/`               | `list_contacts`    |
//! | POST   | `/resolve`        | `resolve_contact`  |
//! | GET    | `/{id}`           | `get_contact`      |
//! | PATCH  | `/{id}`           | `update_contact`   |
//! | POST   | `/{id}/merge`     | `merge_contact`    |
//! | DELETE | `/{id}`           | `delete_contact`   |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `tenant_id == auth.tenant_id`. The
//! tenant id rides on the JWT claims as a hex string and is parsed to an
//! `ObjectId` per-request; a malformed claim yields
//! [`ApiError::Unauthorized`](sabnode_common::ApiError::Unauthorized) so
//! tampered or stale tokens can never leak into other tenants.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatContactsState`] bundle (a Mongo handle), and
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
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatContactsState;

/// Build the SabChat contacts router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/contacts`):
///
/// ```text
/// POST   /                          — create_contact
/// GET    /                          — list_contacts
/// POST   /resolve                   — resolve_contact
/// GET    /{id}                      — get_contact
/// PATCH  /{id}                      — update_contact
/// POST   /{id}/merge                — merge_contact
/// DELETE /{id}                      — delete_contact
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatContactsState`] bundle and the JWT verifier config; both
/// are pulled via [`FromRef`] so the router does not have to know about
/// a concrete monolithic state struct.
///
/// **Route ordering note:** the literal `/resolve` segment is
/// registered before the `/{id}` patterns so axum's matcher prefers the
/// literal over the `{id}` parameter.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatContactsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- literal segment first ------------------------------------
        .route("/resolve", post(handlers::resolve_contact))
        // ---- collection root ------------------------------------------
        .route(
            "/",
            post(handlers::create_contact).get(handlers::list_contacts),
        )
        // ---- per-contact endpoints ------------------------------------
        .route(
            "/{id}",
            get(handlers::get_contact)
                .patch(handlers::update_contact)
                .delete(handlers::delete_contact),
        )
        .route("/{id}/merge", post(handlers::merge_contact))
}
