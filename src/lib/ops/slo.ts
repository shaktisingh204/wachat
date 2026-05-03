/**
 * SLO calculator.
 *
 * Given a list of SLI samples in the SLO's window, computes:
 *   - achievement      : actual good-event ratio in [0, 1]
 *   - errorBudgetRemaining : (achievement - target) / (1 - target), clamped to [0, 1]
 *   - burnRate         : how fast the error budget is being consumed relative
 *                        to the steady-state expectation. burnRate=1 means
 *                        we're using up the budget exactly on schedule.
 *
 * The function is pure and synchronous — no I/O, no clocks beyond what callers
 * provide. This makes it trivial to unit-test and to reuse across edge,
 * Node.js, and worker runtimes.
 */

import type { ErrorBudget, SliSample, Slo, SloWindow } from './types';

/** Convert an SLO window into milliseconds. Used for burn-rate calculations. */
export function windowToMs(window: SloWindow): number {
    switch (window) {
        case '1h':
            return 60 * 60 * 1000;
        case '6h':
            return 6 * 60 * 60 * 1000;
        case '24h':
            return 24 * 60 * 60 * 1000;
        case '7d':
            return 7 * 24 * 60 * 60 * 1000;
        case '28d':
            return 28 * 24 * 60 * 60 * 1000;
        case '30d':
            return 30 * 24 * 60 * 60 * 1000;
        case '90d':
            return 90 * 24 * 60 * 60 * 1000;
    }
}

/** Result of `evaluate`. */
export interface SloEvaluation {
    /** Actual good-event ratio in [0, 1]. */
    achievement: number;
    /** Remaining error budget as a fraction in [0, 1]. */
    errorBudgetRemaining: number;
    /** Burn rate — multiples of expected. >1 means burning too fast. */
    burnRate: number;
    /** Total weight of considered samples. */
    totalEvents: number;
    /** Total weight of "bad" events. */
    badEvents: number;
}

/**
 * Evaluate an SLO against a series of indicator samples.
 *
 * Samples whose `total` is omitted default to 1; `good` is clamped into the
 * inclusive range [0, total] before aggregation so callers cannot accidentally
 * inflate or invert the achievement ratio.
 */
export function evaluate(slo: Slo, samples: SliSample[]): SloEvaluation {
    if (slo.target <= 0 || slo.target >= 1) {
        throw new Error(`SLO target must be in (0, 1), got ${slo.target}`);
    }

    let totalEvents = 0;
    let goodEvents = 0;

    for (const sample of samples) {
        const total = sample.total ?? 1;
        if (total <= 0) continue;
        const good = Math.min(Math.max(sample.good, 0), total);
        totalEvents += total;
        goodEvents += good;
    }

    const achievement = totalEvents === 0 ? 1 : goodEvents / totalEvents;
    const badEvents = totalEvents - goodEvents;
    const allowedBadRatio = 1 - slo.target;
    const errorBudgetRemaining =
        allowedBadRatio === 0
            ? achievement >= 1
                ? 1
                : 0
            : Math.min(Math.max((achievement - slo.target) / allowedBadRatio, 0), 1);

    // Burn rate = actual bad ratio / allowed bad ratio.
    // 1.0 means budget is being consumed exactly on schedule.
    const actualBadRatio = totalEvents === 0 ? 0 : badEvents / totalEvents;
    const burnRate = allowedBadRatio === 0 ? (actualBadRatio === 0 ? 0 : Infinity) : actualBadRatio / allowedBadRatio;

    return {
        achievement,
        errorBudgetRemaining,
        burnRate,
        totalEvents,
        badEvents,
    };
}

/** Convenience: build an `ErrorBudget` snapshot from an evaluation. */
export function toErrorBudget(slo: Slo, evaluation: SloEvaluation, computedAt: number = Date.now()): ErrorBudget {
    return {
        sloId: slo.id,
        window: slo.window,
        total: 1 - slo.target,
        remaining: evaluation.errorBudgetRemaining,
        burnRate: evaluation.burnRate,
        computedAt,
    };
}
