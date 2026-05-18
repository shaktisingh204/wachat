//! SabFlow executor — queue + dispatcher (Track B Phase 2).
//!
//! Inherits the Bull queue topology surveyed in
//! `docs/adr/sabflow-executor-n8n-survey.md` §4 — atomic claim, lock +
//! heartbeat, exponential backoff retries, delayed jobs, stalled-job reclaim,
//! Bull pub/sub completion events. **Diverges** from Bull on one point:
//! the ADR notes that "Bull does not provide a first-class DLQ … a Track B
//! Phase 2 sub-task adds a real DLQ on top". This crate ships that DLQ
//! (this module: [`dlq`]) plus the dispatcher (sibling sub-task #3 — not in
//! this slice).
//!
//! ## Module layout
//!
//! - [`dlq`] — move-to-DLQ logic (LPUSH + HSET + PUBLISH), called by the
//!   dispatcher after `attempts >= maxAttempts` exhausts the retry budget.
//!   Sibling Node module under `src/lib/sabflow/queue/dlq.ts` owns the
//!   admin read / requeue / purge surface and subscribes to the PUBSUB
//!   channel for alert fan-out.

pub mod dlq;

/// Track B Phase 2 stub marker — kept so dependents that previously imported
/// the scaffold placeholder still resolve. Will be removed once the
/// dispatcher (sibling sub-task #3) and the consumer (sub-task #4) land.
pub fn placeholder() -> &'static str {
    "sabflow-executor-queue: phase 2 (dlq landed)"
}
