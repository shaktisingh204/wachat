//! # sabcheckout-subscriptions
//!
//! HTTP surface for SabCheckout subscription records. One document per
//! active/past_due/paused/cancelled subscription, FK'd to a plan + a
//! recurring customer.
//!
//! Backs `sabcheckout_subscriptions`. Mounted under
//! `/v1/sabcheckout/subscriptions`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
