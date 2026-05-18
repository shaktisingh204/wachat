//! sabflow-executor-queue — Track B Phase 2.
//!
//! BullMQ-compatible Redis dispatcher with retry/backoff, DLQ, per-workspace
//! concurrency + rate limiting, cooperative cancellation, graceful shutdown,
//! and metrics. Modules land one per Phase 2 sub-task.

pub mod dispatcher;
pub mod concurrency;
pub mod retry;
pub mod dlq;
pub mod rate_limit;
pub mod shutdown;
pub mod cancel;
pub mod state;
pub mod metrics;

pub use retry::{
    classify_for_retry, delay_for, BackoffStrategy, RetryAction, RetrySpec, CRON_DEFAULT,
    EXECUTION_DEFAULT, WEBHOOK_DEFAULT,
};

pub fn placeholder() -> &'static str {
    "sabflow-executor-queue: phase 2"
}
