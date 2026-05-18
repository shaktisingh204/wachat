//! sabflow-executor-queue — Track B Phase 2.
//!
//! Phase 1 left this crate as a scaffold; Phase 2 sub-task #3 lands the
//! Redis dispatcher worker loop here. Other Phase 2 siblings (queue producer,
//! backoff/retry policy, stalled-job monitor, DLQ, observability) land
//! alongside this module in follow-up sub-tasks.

pub mod dispatcher;

pub mod concurrency;

pub fn placeholder() -> &'static str {
    "sabflow-executor-queue: scaffold"
}
