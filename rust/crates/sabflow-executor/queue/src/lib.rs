//! `sabflow-executor-queue` — worker-side queue helpers for the SabFlow
//! executor (Track B / Phase 2).
//!
//! This Phase-2 slice ships the cancellation honour layer:
//!
//! * [`cancel`] — `CancellationToken` plumbing for the dispatcher, the
//!   `sabflow:cancel:*` Redis pubsub subscriber, the per-node lifecycle
//!   check, and the mid-node abort helpers used by the in-flight
//!   `reqwest` call sites.
//!
//! Siblings #1-#8 own dispatch, leases, drain, retries, etc.; sibling
//! #10 will wire this module into the top-level worker entry point.
//!
//! The `state` module is a **forward declaration** — sibling #4 owns the
//! real Mongo transition function. We expose the same shape here so the
//! per-node lifecycle in [`cancel`] can compile and the integration
//! becomes a one-line swap once sibling #4 lands.

pub mod cancel;
pub mod state;
