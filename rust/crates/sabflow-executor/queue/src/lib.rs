//! # sabflow-executor-queue
//!
//! Dispatcher-side primitives for the SabFlow execution queue. Today the
//! only public surface is [`rate_limit::check_claim_rate`] — the per-
//! workspace + per-plan throttle the dispatcher runs *just before* it
//! claims a job from Redis. The same window is enforced at enqueue time on
//! the TS side (`src/lib/sabflow/queue/rate-limit.ts`); the dispatcher's
//! re-check defends against bursts that slipped past the API boundary.
//!
//! ## Companion file
//!
//! `src/lib/sabflow/queue/rate-limit.ts` is the source of truth for the
//! plan-cap table and Redis key shape. Anything that changes there must be
//! mirrored here (and vice versa) — the two helpers share a bucket key
//! deliberately so they cannot drift in production.
//!
//! ## Stability
//!
//! Track B Phase 2 / sub-task #7 of 10. Surface is intentionally minimal
//! until the rest of the dispatcher lands; we expose just enough to let
//! the work-stealer call `check_claim_rate(workspace_id, plan)` before
//! every `XREADGROUP`-style claim.

pub mod rate_limit;

pub use rate_limit::{RateCheck, check_claim_rate};
