//! SabFlow executor queue primitives.
//!
//! Track B Phase 2 sub-task #5: retry policy + full-jitter exponential
//! backoff for the Rust dispatcher. The dispatcher consults
//! [`classify_for_retry`] to decide whether a failed job should retry,
//! then asks [`delay_for`] for the next attempt's delay.
//!
//! This crate is the Rust dual of `src/lib/sabflow/queue/retry.ts` (which
//! the admin UI uses to render "Next attempt at: …"). Both sides agree on:
//!
//! - error-code taxonomy from `src/lib/sabflow/executor/errors.ts`,
//! - default specs (`EXECUTION_DEFAULT`, `WEBHOOK_DEFAULT`, `CRON_DEFAULT`),
//! - the AWS full-jitter formula
//!   ([builders-library: timeouts-retries-and-backoff-with-jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)).

pub mod retry;

pub use retry::{
    classify_for_retry, delay_for, BackoffStrategy, RetryAction, RetrySpec, CRON_DEFAULT,
    EXECUTION_DEFAULT, WEBHOOK_DEFAULT,
};
