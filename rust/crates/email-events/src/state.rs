//! State slice consumed by the email-events router.
//!
//! Carries the Mongo handle plus a shared `reqwest::Client` that the
//! outbound-fanout path reuses so connection pooling holds across
//! webhook deliveries.

use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct EmailEventsState {
    pub mongo: MongoHandle,
    /// Shared HTTP client for outbound webhook fan-out. Reusing the
    /// same client across deliveries keeps the connection pool warm.
    pub http: reqwest::Client,
}

impl EmailEventsState {
    pub fn new(mongo: MongoHandle, http: reqwest::Client) -> Self {
        Self { mongo, http }
    }
}
