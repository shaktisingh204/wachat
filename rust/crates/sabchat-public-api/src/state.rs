//! State slice consumed by the SabChat public-API router.
//!
//! Handlers only need a Mongo handle today — the public surface is
//! pure CRUD over the `sabchat_contacts`, `sabchat_conversations`, and
//! `sabchat_messages` collections, scoped to whichever tenant the
//! presented API key resolves to.
//!
//! The [`ApiKeyVerifier`](wachat_public_api::ApiKeyVerifier) is wired
//! into the caller's outer state via a **separate**
//! [`FromRef`](axum::extract::FromRef) so the
//! [`ApiKeyAuth`](wachat_public_api::ApiKeyAuth) extractor can pull it
//! out without coupling to this bundle. See [`crate::router`] for the
//! exact `FromRef` contract.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the SabChat public-API router needs. Cheap to
/// clone — the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatPublicApiState {
    /// Mongo handle for direct collection access. Every handler reads /
    /// writes through this; tenant scoping is enforced inline against
    /// the API-key auth context's `tenantId`.
    pub mongo: MongoHandle,
}

impl SabChatPublicApiState {
    /// Construct the state bundle. Used by the orchestrating `api`
    /// crate when wiring the router into the outer `AppState`.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
