//! # sabassist-access-tokens
//!
//! Short-lived one-time tokens for SabAssist customer-side redemption.
//!
//! Exposes both an authenticated technician surface ([`router`]) and a
//! deliberately UNAUTHENTICATED [`public_router`] for `/redeem`. The host
//! crate is expected to mount `public_router` outside any auth middleware.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{public_router, router};
