//! Application state slice consumed by the email-templates router.
//!
//! The router is generic over the caller's outer state `S` and only
//! needs:
//!
//! 1. A [`EmailTemplatesState`] — the Mongo handle bundle below.
//! 2. An `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!    [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Both are pulled via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the email-templates router needs.
///
/// Clone is cheap — `MongoHandle` wraps an `Arc<mongodb::Client>`
/// internally.
#[derive(Clone)]
pub struct EmailTemplatesState {
    /// Mongo handle for direct collection access. The router does its
    /// own Mongo I/O rather than delegate to a separate engine because
    /// the templates surface is CRUD over three closely-related
    /// collections — an engine layer would be a one-method-per-handler
    /// shim with no reuse value.
    pub mongo: MongoHandle,
}
