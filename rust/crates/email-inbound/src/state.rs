//! Application state slice consumed by the email-inbound router.
//!
//! Inbound webhooks are unauthenticated by JWT (providers don't carry
//! one) — tenancy is resolved by matching the path / query token against
//! `email_settings.inboundSecret`. So this state only needs a Mongo
//! handle.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the email-inbound router needs.
///
/// Clone is cheap — `MongoHandle` wraps an `Arc<mongodb::Client>`.
#[derive(Clone)]
pub struct EmailInboundState {
    /// Mongo handle. Used for:
    ///   * resolving `inboundSecret` → `userId` on `email_settings`,
    ///   * threading lookups on `email_threads`,
    ///   * inserts into `email_threads` / `email_messages`.
    pub mongo: MongoHandle,
}
