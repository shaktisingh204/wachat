//! # wachat-config-router
//!
//! Phase 5 slice 6 of the SabNode wachat → Rust port. This crate owns
//! the axum router that mounts every **project / phone / webhook
//! configuration** endpoint under `/v1/wachat/config`. It contains
//! **no business logic** — every handler delegates to one of the
//! engine crates from slices 1–5:
//!
//! | Engine                                    | Slice |
//! | ----------------------------------------- | ----- |
//! | [`wachat_project_config::ProjectConfig`]  | 1     |
//! | [`wachat_phone_sync::PhoneSync`]          | 2     |
//! | [`wachat_webhook_subscribe::WebhookSubscriber`] | 3 |
//! | [`wachat_phone_register::PhoneRegistrar`] | 4     |
//! | [`wachat_qr_codes::QrCodes`]              | 5     |
//!
//! ## Mount path
//!
//! Routes are written **relative** (`/projects/{id}/...`,
//! `/webhooks/...`). The caller (the `api` crate) is expected to nest
//! the result under `/v1/wachat/config`, giving final URLs like
//! `/v1/wachat/config/projects/{id}/phone-numbers/sync`.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need only:
//!
//! - a [`WachatConfigState`] bundle (engine handles + `MongoHandle`),
//!   and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.
//!
//! ## Auth
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor — there is no anonymous access. Per-project endpoints
//! additionally enforce
//! `user.tenant_id == project.userId.to_hex()` after loading the
//! project. The follow-up `sabnode-tenancy` slice will swap that for a
//! membership lookup against `project_members`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;

pub mod dto;
pub mod handlers;
pub mod state;

pub use state::WachatConfigState;

/// Build the wachat config router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/wachat/config`):
///
/// ```text
/// GET    /projects/{id}/public                                                — public project read
/// POST   /projects/manual-setup                                               — manual setup
/// POST   /projects/{id}/phone-numbers/sync                                    — phone-number sync
/// POST   /projects/{id}/phone-numbers/{pnid}/profile                          — update profile
/// GET    /projects/{id}/webhook-subscription   (?waba_id=…)                   — webhook status
/// POST   /webhooks/subscribe-all                                              — subscribe every WABA
/// POST   /projects/{id}/webhooks/subscribe                                    — subscribe one
/// POST   /projects/{id}/phone-numbers/{pnid}/register                         — register
/// POST   /projects/{id}/phone-numbers/{pnid}/request-verification-code        — request code
/// POST   /projects/{id}/phone-numbers/{pnid}/verify-code                      — verify code
/// POST   /projects/{id}/phone-numbers/{pnid}/deregister                       — deregister
/// POST   /projects/{id}/phone-numbers/{pnid}/two-step-pin                     — set 2-step PIN
/// GET    /projects/{id}/phone-numbers/{pnid}/qr-codes                         — list QR codes
/// POST   /projects/{id}/phone-numbers/{pnid}/qr-codes                         — create QR code
/// POST   /projects/{id}/phone-numbers/{pnid}/qr-codes/{code}                  — update QR code
/// DELETE /projects/{id}/phone-numbers/{pnid}/qr-codes/{code}                  — delete QR code
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`WachatConfigState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Route ordering note:** the literal segment routes
/// (`/projects/manual-setup`, `/webhooks/subscribe-all`) are registered
/// before any `/projects/{id}/...` patterns so axum's matcher prefers
/// the literal segment over the `{id}` parameter.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatConfigState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- literal-segment routes (must precede /projects/{id}) -----
        .route(
            "/projects/manual-setup",
            post(handlers::projects_manual_setup),
        )
        .route(
            "/webhooks/subscribe-all",
            post(handlers::webhooks_subscribe_all),
        )
        // ---- project read ---------------------------------------------
        .route(
            "/projects/{id}/public",
            get(handlers::projects_get_public),
        )
        // ---- phone-number sync + profile ------------------------------
        .route(
            "/projects/{id}/phone-numbers/sync",
            post(handlers::phone_numbers_sync),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/profile",
            post(handlers::phone_numbers_update_profile),
        )
        // ---- webhook subscription -------------------------------------
        .route(
            "/projects/{id}/webhook-subscription",
            get(handlers::webhook_subscription_status),
        )
        .route(
            "/projects/{id}/webhooks/subscribe",
            post(handlers::webhooks_subscribe_one),
        )
        // ---- phone-number registration --------------------------------
        .route(
            "/projects/{id}/phone-numbers/{pnid}/register",
            post(handlers::phone_numbers_register),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/request-verification-code",
            post(handlers::phone_numbers_request_verification_code),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/verify-code",
            post(handlers::phone_numbers_verify_code),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/deregister",
            post(handlers::phone_numbers_deregister),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/two-step-pin",
            post(handlers::phone_numbers_two_step_pin),
        )
        // ---- QR codes -------------------------------------------------
        .route(
            "/projects/{id}/phone-numbers/{pnid}/qr-codes",
            get(handlers::qr_codes_list).post(handlers::qr_codes_create),
        )
        .route(
            "/projects/{id}/phone-numbers/{pnid}/qr-codes/{code}",
            post(handlers::qr_codes_update).delete(handlers::qr_codes_delete),
        )
}
