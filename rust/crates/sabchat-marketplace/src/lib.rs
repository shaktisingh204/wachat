//! # sabchat-marketplace
//!
//! Phase — axum router that owns the SabChat **marketplace** HTTP surface.
//! Mounted under `/v1/sabchat/marketplace` from the orchestrating `api` crate.
//!
//! ## Scope
//!
//! The router drives the app marketplace installation and uninstallation:
//!
//! 1. **Install App** — create a new installed app under a tenant.
//! 2. **List / Get Apps** — retrieve installed apps.
//! 3. **Uninstall App** — remove an installed app.
//!
//! ## Collections
//!
//! | Collection                | Purpose                                |
//! |---------------------------|----------------------------------------|
//! | `sabchat_installed_apps`  | One doc per installed app.             |
//!
//! ## Routes
//!
//! ```text
//! POST   /                              — install_app
//! GET    /                              — list_installed_apps
//! GET    /{id}                          — get_installed_app
//! DELETE /{id}                          — uninstall_app
//! ```
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. All Mongo queries scope to `tenant_id` from the JWT — the
//! router never trusts a tenant-id off the wire.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. Handlers
//! need:
//!
//! - a [`SabChatMarketplaceState`] bundle (just a Mongo handle today), and
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
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatMarketplaceState;

/// Build the SabChat marketplace router.
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatMarketplaceState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatMarketplaceState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- installed apps collection root ---------------------------
        .route(
            "/",
            post(handlers::install_app).get(handlers::list_installed_apps),
        )
        // ---- per-app endpoints ----------------------------------------
        .route(
            "/{id}",
            get(handlers::get_installed_app).delete(handlers::uninstall_app),
        )
}
