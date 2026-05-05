//! Application state slice consumed by the wachat config router.
//!
//! The router is generic over the caller's outer state `S` and only asks
//! for two things via [`FromRef`](axum::extract::FromRef):
//!
//! 1. A [`WachatConfigState`] — the bundle of engine handles below.
//! 2. An `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!    [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Each engine handle is internally `Arc`-backed and cheap to clone, so
//! the bundle itself is also cheap. The orchestrating `api` crate
//! constructs a single `WachatConfigState` at boot and exposes it from
//! its `AppState` via `FromRef`.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;
use wachat_phone_register::PhoneRegistrar;
use wachat_phone_sync::PhoneSync;
use wachat_project_config::ProjectConfig;
use wachat_qr_codes::QrCodes;
use wachat_webhook_subscribe::WebhookSubscriber;

/// Bundle of engine handles the config router needs to satisfy every
/// route. Clone is cheap — every field is `Arc`-backed.
///
/// `mongo` is held alongside the engines because every per-project
/// handler needs to look up a `Project` document to enforce per-project
/// tenancy (`AuthUser::tenant_id == project.userId.to_hex()`) before
/// delegating to an engine that takes `&Project`.
#[derive(Clone)]
pub struct WachatConfigState {
    /// Project read + manual-setup engine (Phase 5 slice 1).
    pub project: Arc<ProjectConfig>,

    /// Phone-number sync + profile-update engine (Phase 5 slice 2).
    pub phone_sync: Arc<PhoneSync>,

    /// WABA webhook subscription status / subscribe-one / subscribe-all
    /// engine (Phase 5 slice 3).
    pub subscribe: Arc<WebhookSubscriber>,

    /// Phone-number register / request-code / verify-code / deregister /
    /// two-step-pin engine (Phase 5 slice 4).
    pub register: Arc<PhoneRegistrar>,

    /// Message-QR-code list / create / update / delete engine
    /// (Phase 5 slice 5).
    pub qr: Arc<QrCodes>,

    /// Mongo handle for direct project lookups (per-project tenancy
    /// guard runs before delegating to the engines that need a
    /// `&Project`).
    pub mongo: MongoHandle,
}
