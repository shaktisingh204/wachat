/**
 * SabFlow queue — retry policy + full-jitter exponential backoff (TS dual).
 * --------------------------------------------------------------------
 *
 * Track B Phase 2 sub-task #5: TypeScript dual of the Rust dispatcher's
 * retry primitives in `rust/crates/sabflow-executor/queue/src/retry.rs`.
 *
 * **Two callers:**
 * 1. **enqueue path** — picks the right {@link RetrySpec} (per
 *    `executionDefault` / `webhookDefault` / `cronDefault`) when a job is
 *    pushed to the queue, so it's persisted alongside the job payload.
 * 2. **admin UI** — uses {@link delayFor} + {@link nextAttemptAt} to render
 *    "Next attempt at: …" on failed-job rows without round-tripping to the
 *    Rust dispatcher.
 *
 * The retry *classification* itself (whether a job's last error is
 * retryable at all) lives in `src/lib/sabflow/executor/errors.ts` —
 * specifically {@link isRetryable} from that module. This file is only
 * about *how long* to wait once the dispatcher has decided to retry.
 *
 * Both sides agree on:
 * - default specs (`EXECUTION_DEFAULT`, `WEBHOOK_DEFAULT`, `CRON_DEFAULT`),
 * - the AWS full-jitter formula
 *   ([builders-library: timeouts-retries-and-backoff-with-jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)).
 *
 * @module sabflow/queue/retry
 */

/* ------------------------------------------------------------------ */
/* Spec types                                                          */
/* ------------------------------------------------------------------ */

/**
 * Backoff curve used by {@link delayFor}.
 *
 * - `exponential_jitter` — AWS full-jitter:
 *   `random(0, min(cap, base * 2^(attempt-1)))`. Best thundering-herd
 *   avoidance under coordinated 429/5xx.
 * - `fixed_delay` — always `baseMs`, clamped at `capMs`.
 * - `linear` — `min(capMs, baseMs * attempt)`.
 */
export type BackoffStrategy = 'exponential_jitter' | 'fixed_delay' | 'linear';

/**
 * Tunables the dispatcher / admin UI need to compute the delay before
 * the next attempt. Field names match the Rust struct snake-cased so a
 * single JSON shape round-trips both sides.
 */
export interface RetrySpec {
	/** Maximum number of *total* attempts (the first try counts as 1). */
	maxTries: number;
	/** Base delay in milliseconds for attempt 1's backoff calculation. */
	baseMs: number;
	/** Cap on the computed delay in milliseconds. */
	capMs: number;
	/** Which curve to walk between `baseMs` and `capMs`. */
	strategy: BackoffStrategy;
}

/* ------------------------------------------------------------------ */
/* Defaults — mirrored exactly with the Rust constants                 */
/* ------------------------------------------------------------------ */

/**
 * Default spec for regular workflow-node executions: 3 tries, 500 ms
 * base, 30 s cap, full-jitter exponential.
 */
export const EXECUTION_DEFAULT: RetrySpec = {
	maxTries: 3,
	baseMs: 500,
	capMs: 30_000,
	strategy: 'exponential_jitter',
};

/**
 * Default spec for webhook-trigger replays: 5 tries, 1 s base, 60 s cap,
 * full-jitter exponential. Webhooks tolerate longer waits than node
 * calls because the upstream is usually a 3rd-party API that returned a
 * 5xx / 429.
 */
export const WEBHOOK_DEFAULT: RetrySpec = {
	maxTries: 5,
	baseMs: 1_000,
	capMs: 60_000,
	strategy: 'exponential_jitter',
};

/**
 * Default spec for cron-trigger jobs: never retry in-band — the next
 * fire of the cron schedule is the retry.
 */
export const CRON_DEFAULT: RetrySpec = {
	maxTries: 1,
	baseMs: 0,
	capMs: 0,
	strategy: 'fixed_delay',
};

/* ------------------------------------------------------------------ */
/* Backoff                                                             */
/* ------------------------------------------------------------------ */

/**
 * Compute the wait in milliseconds before `attempt` (1-indexed:
 * `attempt === 1` is the delay before the *first* retry, i.e. between
 * try 1 and try 2).
 *
 * Returns `0` when `attempt === 0` (caller hasn't tried yet) or when
 * `capMs === 0` (spec disables backoff).
 *
 * The AWS full-jitter formula is:
 *
 * ```text
 * exp   = min(capMs, baseMs * 2^(attempt - 1))
 * delay = random_between(0, exp)
 * ```
 *
 * This mirrors the `fullJitter` helper in
 * `src/lib/sabflow/executor/errors.ts` and the Rust `delay_for` in
 * `rust/crates/sabflow-executor/queue/src/retry.rs`.
 *
 * @example
 * ```ts
 * // Admin UI: render "Next attempt at: …" for a failed job.
 * const ms = delayFor(job.attempt + 1, EXECUTION_DEFAULT);
 * const eta = new Date(job.failedAt.getTime() + ms);
 * ```
 */
export function delayFor(attempt: number, spec: RetrySpec): number {
	if (attempt <= 0 || spec.capMs <= 0) return 0;
	switch (spec.strategy) {
		case 'fixed_delay':
			return Math.min(spec.baseMs, spec.capMs);
		case 'linear':
			return Math.min(spec.capMs, spec.baseMs * attempt);
		case 'exponential_jitter': {
			// Clamp the shift so absurd `attempt` values don't overflow
			// `Number` semantics on cumulative multiplications.
			const shift = Math.min(63, Math.max(0, attempt - 1));
			const exp = Math.min(spec.capMs, spec.baseMs * 2 ** shift);
			if (exp <= 0) return 0;
			return Math.floor(Math.random() * (exp + 1));
		}
	}
}

/**
 * Convenience for the admin UI: returns the absolute `Date` at which
 * the next attempt is scheduled, given the *previous* failure's
 * timestamp and the spec.
 *
 * @example
 * ```tsx
 * <td>{nextAttemptAt(job.failedAt, job.attempt + 1, EXECUTION_DEFAULT).toISOString()}</td>
 * ```
 */
export function nextAttemptAt(
	previousFailedAt: Date,
	nextAttempt: number,
	spec: RetrySpec,
): Date {
	return new Date(previousFailedAt.getTime() + delayFor(nextAttempt, spec));
}

/**
 * True iff the dispatcher should *attempt* `nextAttempt` given the spec
 * (i.e. the cap hasn't been hit). Both the admin UI ("show 'will retry'
 * badge?") and the enqueue path use this to short-circuit.
 *
 * @example
 * ```ts
 * if (!hasAttemptsRemaining(job.attempt + 1, spec)) {
 *   await deadLetter(job);
 * }
 * ```
 */
export function hasAttemptsRemaining(nextAttempt: number, spec: RetrySpec): boolean {
	return nextAttempt <= spec.maxTries;
}
