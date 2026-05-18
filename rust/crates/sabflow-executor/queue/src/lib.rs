//! sabflow-executor-queue — Track B Phase 2.
//!
//! Houses the SabFlow execution-queue plumbing: BullMQ-compatible Redis
//! dispatcher worker loop (`dispatcher`), per-workspace concurrency caps
//! (`concurrency`), retry policy + full-jitter exponential backoff (`retry`),
//! and follow-up modules added by remaining Phase 2 sub-tasks.

pub mod dispatcher;
pub mod concurrency;
pub mod retry;

pub use retry::{
    classify_for_retry, delay_for, BackoffStrategy, RetryAction, RetrySpec, CRON_DEFAULT,
    EXECUTION_DEFAULT, WEBHOOK_DEFAULT,
};

pub fn placeholder() -> &'static str {
    "sabflow-executor-queue: scaffold"
}
