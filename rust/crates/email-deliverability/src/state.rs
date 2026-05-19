//! Application state slice consumed by the email-deliverability router.
//!
//! The router is generic over the caller's outer state `S` and only asks
//! for two things via [`FromRef`](axum::extract::FromRef):
//!
//! 1. An [`EmailDeliverabilityState`] — the bundle of handles below.
//! 2. An `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!    [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Both are `Arc`-backed and cheap to clone.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the email-deliverability router needs.
#[derive(Clone)]
pub struct EmailDeliverabilityState {
    /// Mongo handle. Used for `email_dns_snapshots`, `email_settings`,
    /// `email_warmup_runs`, `email_placement_tests`, and (read-only)
    /// `email_events` for the score rollup.
    pub mongo: MongoHandle,
}

impl EmailDeliverabilityState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
