//! Retry policy + full-jitter exponential backoff for the Rust dispatcher.
//!
//! Mirrors `src/lib/sabflow/executor/errors.ts` (`isRetryable`,
//! `retryPolicy`) and is paired with `src/lib/sabflow/queue/retry.ts`
//! which the admin UI uses for "Next attempt at: …" rendering.
//!
//! # Design
//!
//! The dispatcher's hot loop is:
//!
//! ```text
//! loop {
//!     match run(job).await {
//!         Ok(_)  => mark_done(job),
//!         Err(e) => match classify_for_retry(&e.code) {
//!             RetryAction::Permanent              => dead_letter(job, e),
//!             RetryAction::Retryable              => requeue(job, delay_for(job.attempt, &spec)),
//!             RetryAction::RespectRetryAfter(d)   => requeue(job, d),
//!         },
//!     }
//! }
//! ```
//!
//! The classification is intentionally string-based so the dispatcher can
//! consume wire-format errors (`WireError.code` from the TS side) without
//! re-hydrating typed enums.

use std::time::Duration;

use rand::Rng;
use serde::{Deserialize, Serialize};

/* ------------------------------------------------------------------ */
/* Spec types                                                         */
/* ------------------------------------------------------------------ */

/// Backoff strategy used by [`delay_for`].
///
/// - [`BackoffStrategy::ExponentialJitter`]: AWS full-jitter
///   `random(0, min(cap, base * 2^(attempt-1)))`. Best for shedding load
///   under thundering-herd conditions.
/// - [`BackoffStrategy::FixedDelay`]: always `base_ms`, clamped at `cap_ms`.
/// - [`BackoffStrategy::Linear`]: `min(cap_ms, base_ms * attempt)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackoffStrategy {
    ExponentialJitter,
    FixedDelay,
    Linear,
}

/// Knobs the dispatcher needs to compute the delay before the next attempt.
///
/// Defaults are exposed as [`EXECUTION_DEFAULT`], [`WEBHOOK_DEFAULT`], and
/// [`CRON_DEFAULT`]. Construct your own for one-off cases.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RetrySpec {
    /// Maximum number of *total* attempts (the first try counts as 1).
    pub max_tries: u32,
    /// Base delay in milliseconds for attempt 1's backoff calculation.
    pub base_ms: u64,
    /// Cap on the computed delay in milliseconds.
    pub cap_ms: u64,
    /// Which curve to walk between `base_ms` and `cap_ms`.
    pub strategy: BackoffStrategy,
}

/* ------------------------------------------------------------------ */
/* Defaults                                                           */
/* ------------------------------------------------------------------ */

/// Default spec for regular workflow-node executions: 3 tries, 500 ms base,
/// 30 s cap, full-jitter exponential.
pub const EXECUTION_DEFAULT: RetrySpec = RetrySpec {
    max_tries: 3,
    base_ms: 500,
    cap_ms: 30_000,
    strategy: BackoffStrategy::ExponentialJitter,
};

/// Default spec for webhook-trigger replays: 5 tries, 1 s base, 60 s cap,
/// full-jitter exponential. Webhooks tolerate longer waits than node calls
/// because the upstream is usually a 3rd-party API that returned a 5xx/429.
pub const WEBHOOK_DEFAULT: RetrySpec = RetrySpec {
    max_tries: 5,
    base_ms: 1_000,
    cap_ms: 60_000,
    strategy: BackoffStrategy::ExponentialJitter,
};

/// Default spec for cron-trigger jobs: never retry in-band — the next fire
/// of the cron schedule is the retry.
pub const CRON_DEFAULT: RetrySpec = RetrySpec {
    max_tries: 1,
    base_ms: 0,
    cap_ms: 0,
    strategy: BackoffStrategy::FixedDelay,
};

/* ------------------------------------------------------------------ */
/* Backoff                                                            */
/* ------------------------------------------------------------------ */

/// Compute the wait before `attempt` (1-indexed: `attempt == 1` is the
/// delay before the *first* retry, i.e. between try 1 and try 2).
///
/// Returns [`Duration::ZERO`] when `attempt == 0` (caller hasn't tried
/// yet) or when `cap_ms == 0` (spec disables backoff).
///
/// The AWS full-jitter formula is:
///
/// ```text
/// exp = min(cap_ms, base_ms * 2^(attempt - 1))
/// delay = random_between(0, exp)
/// ```
///
/// This mirrors the `fullJitter` helper in
/// `src/lib/sabflow/executor/errors.ts`.
pub fn delay_for(attempt: u32, spec: &RetrySpec) -> Duration {
    if attempt == 0 || spec.cap_ms == 0 {
        return Duration::ZERO;
    }
    let ms = match spec.strategy {
        BackoffStrategy::FixedDelay => spec.base_ms.min(spec.cap_ms),
        BackoffStrategy::Linear => spec.base_ms.saturating_mul(attempt as u64).min(spec.cap_ms),
        BackoffStrategy::ExponentialJitter => {
            // `base_ms * 2^(attempt - 1)`, saturating so we never overflow
            // on absurd `attempt` values. The cap clamps this back to a
            // sensible range before we sample.
            let shift = (attempt - 1).min(63);
            let exp = spec
                .base_ms
                .saturating_mul(1u64.checked_shl(shift).unwrap_or(u64::MAX))
                .min(spec.cap_ms);
            if exp == 0 {
                0
            } else {
                // `gen_range(0..=exp)` matches the TS `Math.floor(random()*exp)`
                // distribution closely enough for thundering-herd avoidance.
                rand::thread_rng().gen_range(0..=exp)
            }
        }
    };
    Duration::from_millis(ms)
}

/* ------------------------------------------------------------------ */
/* Classification                                                     */
/* ------------------------------------------------------------------ */

/// What the dispatcher should do with a failed job, given its error code.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RetryAction {
    /// Eligible for the configured retry policy. The dispatcher should
    /// call [`delay_for`] with the spec it picked for the job class.
    Retryable,
    /// Will never succeed on retry — send straight to dead-letter.
    Permanent,
    /// Upstream told us when to come back (e.g. HTTP `Retry-After`).
    /// Use the wrapped [`Duration`] instead of the spec's curve for the
    /// next attempt.
    RespectRetryAfter(Duration),
}

/// String-based mirror of the TS `isRetryable` taxonomy.
///
/// Accepts both the canonical wire codes from
/// `src/lib/sabflow/executor/errors.ts` (`NODE_API`, `NODE_OPERATION`,
/// `CREDENTIALS`, `EXPRESSION`, `RESOURCE_LIMIT`, `WORKFLOW_VALIDATION`)
/// AND the spec aliases used in the Track B sub-task description
/// (`*_ERROR` suffixes, `RESOURCE_LIMIT_TRANSIENT`,
/// `RESOURCE_LIMIT_PERMANENT`). Matching is case-insensitive on a
/// normalized key so the dispatcher can pass whichever flavor it has.
///
/// Codes the TS taxonomy doesn't carry (e.g. `RESOURCE_LIMIT_TRANSIENT`)
/// resolve unambiguously here; ambiguous `RESOURCE_LIMIT` defers to
/// "retryable" because the typed TS path defaults to `kind === 'transient'`
/// in the common case, and the dispatcher can override via the typed
/// `kind` field when it carries the detail.
pub fn classify_for_retry(error_code: &str) -> RetryAction {
    let normalized = error_code.trim().to_ascii_uppercase();
    match normalized.as_str() {
        // ----- Transient: HTTP-from-node-X errors (5xx/429/408 lives in
        // the dispatcher's per-error inspection, but the classifier
        // treats the *category* as retryable; the dispatcher may
        // upgrade to RespectRetryAfter if it parsed a header).
        "NODE_API" | "NODE_API_ERROR" => RetryAction::Retryable,

        // ----- Transient: timeouts always retry (next attempt may land
        // on a less-loaded worker / healthier upstream).
        "EXECUTION_TIMEOUT" | "EXECUTION_TIMEOUT_ERROR" => RetryAction::Retryable,

        // ----- Resource limits split by kind.
        "RESOURCE_LIMIT_TRANSIENT" => RetryAction::Retryable,
        "RESOURCE_LIMIT_PERMANENT" => RetryAction::Permanent,
        // Bare `RESOURCE_LIMIT` (TS wire-format code without `kind`
        // detail) defaults to retryable; dispatcher should override
        // using the typed `kind` field when known.
        "RESOURCE_LIMIT" => RetryAction::Retryable,

        // ----- Permanent: user / node-author / workflow-author mistakes.
        "NODE_OPERATION" | "NODE_OPERATION_ERROR" => RetryAction::Permanent,
        "CREDENTIALS" | "CREDENTIALS_ERROR" => RetryAction::Permanent,
        "EXPRESSION" | "EXPRESSION_ERROR" => RetryAction::Permanent,
        "WORKFLOW_VALIDATION" | "WORKFLOW_VALIDATION_ERROR" => RetryAction::Permanent,

        // ----- Fail-closed for unknown codes (matches the TS
        // `isRetryable` default — anything not on the allow-list does
        // not retry).
        _ => RetryAction::Permanent,
    }
}

/// Convenience constructor for the `RespectRetryAfter` arm, exposed so
/// the dispatcher can wrap a parsed `Retry-After` header from a
/// `NODE_API` error without re-implementing the variant in callers.
pub fn respect_retry_after(after: Duration) -> RetryAction {
    RetryAction::RespectRetryAfter(after)
}

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_spec() {
        assert_eq!(EXECUTION_DEFAULT.max_tries, 3);
        assert_eq!(EXECUTION_DEFAULT.base_ms, 500);
        assert_eq!(EXECUTION_DEFAULT.cap_ms, 30_000);
        assert_eq!(
            EXECUTION_DEFAULT.strategy,
            BackoffStrategy::ExponentialJitter
        );

        assert_eq!(WEBHOOK_DEFAULT.max_tries, 5);
        assert_eq!(WEBHOOK_DEFAULT.base_ms, 1_000);
        assert_eq!(WEBHOOK_DEFAULT.cap_ms, 60_000);

        assert_eq!(CRON_DEFAULT.max_tries, 1);
        assert_eq!(CRON_DEFAULT.base_ms, 0);
        assert_eq!(CRON_DEFAULT.cap_ms, 0);
    }

    #[test]
    fn delay_for_attempt_zero_is_zero() {
        assert_eq!(delay_for(0, &EXECUTION_DEFAULT), Duration::ZERO);
    }

    #[test]
    fn delay_for_cron_is_zero() {
        // CRON_DEFAULT disables in-band backoff (cap_ms == 0).
        for attempt in 1..=5 {
            assert_eq!(delay_for(attempt, &CRON_DEFAULT), Duration::ZERO);
        }
    }

    #[test]
    fn full_jitter_respects_cap() {
        // With cap == 30s, no single sample should exceed 30s, even for
        // a large `attempt` that would overflow naive `2^attempt`.
        for attempt in 1..=20 {
            let d = delay_for(attempt, &EXECUTION_DEFAULT);
            assert!(d <= Duration::from_millis(EXECUTION_DEFAULT.cap_ms));
        }
    }

    #[test]
    fn fixed_delay_is_constant() {
        let spec = RetrySpec {
            max_tries: 3,
            base_ms: 250,
            cap_ms: 1_000,
            strategy: BackoffStrategy::FixedDelay,
        };
        assert_eq!(delay_for(1, &spec), Duration::from_millis(250));
        assert_eq!(delay_for(7, &spec), Duration::from_millis(250));
    }

    #[test]
    fn fixed_delay_clamps_to_cap() {
        let spec = RetrySpec {
            max_tries: 3,
            base_ms: 5_000,
            cap_ms: 1_000,
            strategy: BackoffStrategy::FixedDelay,
        };
        assert_eq!(delay_for(1, &spec), Duration::from_millis(1_000));
    }

    #[test]
    fn linear_grows_then_clamps() {
        let spec = RetrySpec {
            max_tries: 10,
            base_ms: 100,
            cap_ms: 350,
            strategy: BackoffStrategy::Linear,
        };
        assert_eq!(delay_for(1, &spec), Duration::from_millis(100));
        assert_eq!(delay_for(2, &spec), Duration::from_millis(200));
        assert_eq!(delay_for(3, &spec), Duration::from_millis(300));
        assert_eq!(delay_for(4, &spec), Duration::from_millis(350));
        assert_eq!(delay_for(99, &spec), Duration::from_millis(350));
    }

    #[test]
    fn classify_retryable_codes() {
        assert_eq!(classify_for_retry("NODE_API_ERROR"), RetryAction::Retryable);
        assert_eq!(classify_for_retry("NODE_API"), RetryAction::Retryable);
        assert_eq!(
            classify_for_retry("EXECUTION_TIMEOUT"),
            RetryAction::Retryable
        );
        assert_eq!(
            classify_for_retry("RESOURCE_LIMIT_TRANSIENT"),
            RetryAction::Retryable
        );
    }

    #[test]
    fn classify_permanent_codes() {
        assert_eq!(
            classify_for_retry("NODE_OPERATION_ERROR"),
            RetryAction::Permanent
        );
        assert_eq!(
            classify_for_retry("CREDENTIALS_ERROR"),
            RetryAction::Permanent
        );
        assert_eq!(
            classify_for_retry("EXPRESSION_ERROR"),
            RetryAction::Permanent
        );
        assert_eq!(
            classify_for_retry("WORKFLOW_VALIDATION_ERROR"),
            RetryAction::Permanent
        );
        assert_eq!(
            classify_for_retry("RESOURCE_LIMIT_PERMANENT"),
            RetryAction::Permanent
        );
    }

    #[test]
    fn classify_unknown_is_permanent() {
        // Fail-closed for codes the dispatcher doesn't recognize.
        assert_eq!(classify_for_retry("MYSTERY_CODE"), RetryAction::Permanent);
        assert_eq!(classify_for_retry(""), RetryAction::Permanent);
    }

    #[test]
    fn classify_is_case_insensitive() {
        assert_eq!(classify_for_retry("node_api_error"), RetryAction::Retryable);
        assert_eq!(
            classify_for_retry("  Execution_Timeout  "),
            RetryAction::Retryable
        );
    }

    #[test]
    fn respect_retry_after_helper() {
        let d = Duration::from_secs(7);
        assert_eq!(respect_retry_after(d), RetryAction::RespectRetryAfter(d));
    }
}
