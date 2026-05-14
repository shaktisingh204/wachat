//! Anti-ban / compliance layer for SabWa.
//!
//! This module groups the runtime controls that keep a personal-WhatsApp
//! session out of WhatsApp's ban filters. It implements **SABWA_PLAN.md
//! section 9** ("Anti-ban / compliance layer"):
//!
//! - [`profiles`] — per-session rate profiles (safe / normal / aggressive)
//!   that fix the per-minute, per-day and jitter envelopes.
//! - [`rate_limit`] — Redis-backed sliding-window limiter that consults
//!   those profiles and decides Allow / Throttle / BlockedDaily.
//! - [`warmup`] — linear ramp from 5/min to the profile's `per_min` over
//!   the first 7 days of a brand-new session.
//! - [`risk_score`] — pure function that turns recent failure signals into
//!   a 0..100 ban-risk gauge with a discrete level + human reasons.
//!
//! Everything except `rate_limit` is pure (no I/O), so the same logic can
//! be reused by the scheduler, the realtime layer, and the admin overview
//! gauge without dragging in a Redis client.

pub mod profiles;
pub mod rate_limit;
pub mod risk_score;
pub mod warmup;

pub use profiles::{ProfileConfig, RateProfile};
pub use rate_limit::{Limiter, LimiterDecision};
