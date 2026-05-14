//! Outbound webhook subsystem for the SabWa engine.
//!
//! Implements `SABWA_PLAN.md` §12 — signed HMAC-SHA256 deliveries with
//! exponential-backoff retries.
//!
//! Layout:
//! - [`signing`]    — HMAC-SHA256 payload signing helpers.
//! - [`delivery`]   — single-attempt HTTP POST + retry-schedule policy +
//!                    `sabwa_webhook_deliveries` Mongo document shape.
//! - [`dispatcher`] — long-running task that bridges the realtime Redis
//!                    pub/sub fan-out to registered subscriber URLs.

pub mod delivery;
pub mod dispatcher;
pub mod signing;

pub use dispatcher::Dispatcher;
pub use signing::sign_payload;
