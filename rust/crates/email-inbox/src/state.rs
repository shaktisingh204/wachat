//! Application state slice consumed by the email-inbox router.
//!
//! The router is generic over the caller's outer state `S` and only asks
//! for two things via [`FromRef`](axum::extract::FromRef):
//!
//! 1. An [`EmailInboxState`] — the bundle of handles below.
//! 2. An `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!    [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Both fields are internally `Arc`-backed (via the underlying client
//! handles) and cheap to clone.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the email-inbox router needs to satisfy every route.
///
/// Clone is cheap — `MongoHandle` wraps an `Arc<mongodb::Client>`.
#[derive(Clone)]
pub struct EmailInboxState {
    /// Mongo handle for direct collection access. The inbox surface is
    /// CRUD over `email_threads` / `email_messages` / `email_assignments`
    /// with no provider I/O at this layer (provider send is deferred to
    /// the `email-sender` worker).
    pub mongo: MongoHandle,
}
