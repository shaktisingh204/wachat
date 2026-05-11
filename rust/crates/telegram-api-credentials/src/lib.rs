//! # telegram-api-credentials
//!
//! Multi-tenant store for Telegram MTProto API credentials
//! (`api_id` + `api_hash` obtained from <https://my.telegram.org>),
//! along with placeholder endpoints for the interactive login flow
//! (`sendCode` → code → optional 2FA password) that a future MTProto
//! worker crate will fully implement.
//!
//! ## Why a separate crate?
//!
//! `api_hash` is a long-lived secret that effectively impersonates the
//! Telegram **user account**, not just a bot. It deserves its own
//! audit trail, status machine, and revocation surface — distinct from
//! the Bot API token stored in `telegram-bots`.
//!
//! ## Storage caveat
//!
//! The wave-1 implementation stores `api_hash` **plain at rest**,
//! mirroring [`telegram-payments`]'s provider-token storage, because
//! `sabnode-common` does not yet expose an envelope-encryption helper.
//! All read endpoints mask the value (`apiHashMasked`); the only place
//! the raw value escapes the database is via [`get_credential`], an
//! in-process helper reserved for the (not-yet-built) MTProto worker.
//!
//! Mounted at `/v1/telegram/api-credentials`.

pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use handlers::get_credential;
pub use state::TelegramApiCredentialsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramApiCredentialsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::create))
        .route("/audit", get(handlers::audit_list))
        .route(
            "/{credential_id}",
            get(handlers::detail)
                .put(handlers::update)
                .delete(handlers::delete_credential),
        )
        .route("/{credential_id}/verify", post(handlers::verify))
        .route("/{credential_id}/login/start", post(handlers::login_start))
        .route("/{credential_id}/login/code", post(handlers::login_code))
        .route(
            "/{credential_id}/login/password",
            post(handlers::login_password),
        )
        .route("/{credential_id}/logout", post(handlers::logout))
        .route("/{credential_id}/sessions", get(handlers::list_sessions))
}
