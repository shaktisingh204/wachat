//! sabflow-executor-queue — Track B Phase 2.
//!
//! BullMQ-compatible Redis dispatcher with retry/backoff, DLQ, per-workspace
//! concurrency + rate limiting, cooperative cancellation, graceful shutdown,
//! and metrics. Modules land one per Phase 2 sub-task.

pub mod cancel;
pub mod concurrency;
pub mod dispatcher;
pub mod dlq;
pub mod metrics;
pub mod rate_limit;
pub mod retry;
pub mod shutdown;
pub mod state;

pub use retry::{
    BackoffStrategy, CRON_DEFAULT, EXECUTION_DEFAULT, RetryAction, RetrySpec, WEBHOOK_DEFAULT,
    classify_for_retry, delay_for,
};

pub fn placeholder() -> &'static str {
    "sabflow-executor-queue: phase 2"
}
