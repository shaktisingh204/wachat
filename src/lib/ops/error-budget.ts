/**
 * 28-day rolling error-budget tracking with multi-window burn-rate alerting.
 *
 * Implements the canonical Google SRE recommendation:
 *
 *   - Fast burn  (1h window) : page when burn-rate > 14.4× for 5+ minutes
 *                              (would exhaust 28-day budget in <2 days)
 *   - Slow burn  (6h window) : page when burn-rate > 6×    for 30+ minutes
 *                              (would exhaust 28-day budget in <5 days)
 *
 * The thresholds below correspond to those alert tiers but are exposed as
 * named constants so callers can override them per-SLO if needed.
 */

import { evaluate, toErrorBudget, windowToMs } from './slo';
import type { BurnRateAlert, ErrorBudget, SliSample, Slo, SloWindow } from './types';

/** Default burn-rate thresholds for fast/slow alerts. */
export const BURN_RATE_FAST_THRESHOLD = 14.4;
export const BURN_RATE_SLOW_THRESHOLD = 6;

/** Required SLO window for the rolling-budget tracker. */
export const ROLLING_BUDGET_WINDOW: SloWindow = '28d';

/** Filter samples to those that fall inside the [now-windowMs, now] range. */
export function windowSamples(samples: SliSample[], window: SloWindow, now: number = Date.now()): SliSample[] {
    const cutoff = now - windowToMs(window);
    return samples.filter((s) => s.timestamp >= cutoff && s.timestamp <= now);
}

/**
 * Compute the rolling 28-day error budget for an SLO.
 *
 * `slo.window` is overridden to '28d' regardless of the original value, since
 * this helper is specifically about long-window budgets. Use `evaluate()`
 * directly for arbitrary windows.
 */
export function rollingErrorBudget(slo: Slo, samples: SliSample[], now: number = Date.now()): ErrorBudget {
    const rollingSlo: Slo = { ...slo, window: ROLLING_BUDGET_WINDOW };
    const inWindow = windowSamples(samples, ROLLING_BUDGET_WINDOW, now);
    const evaluation = evaluate(rollingSlo, inWindow);
    return toErrorBudget(rollingSlo, evaluation, now);
}

/** Burn-rate alert evaluation for a single window (1h or 6h). */
export interface BurnRateWindowAlert {
    window: SloWindow;
    burnRate: number;
    threshold: number;
    triggered: boolean;
}

/** Final burn-rate alert decision combining fast and slow windows. */
export interface BurnRateAlertResult {
    /** 'fast' | 'slow' | 'ok' — the highest-severity alert that fired. */
    severity: BurnRateAlert;
    fast: BurnRateWindowAlert;
    slow: BurnRateWindowAlert;
}

/**
 * Evaluate burn-rate alerts.
 *
 * Returns 'fast' when the 1h burn-rate exceeds {@link BURN_RATE_FAST_THRESHOLD};
 * 'slow' when the 6h burn-rate exceeds {@link BURN_RATE_SLOW_THRESHOLD};
 * otherwise 'ok'. 'fast' wins ties.
 */
export function evaluateBurnRate(
    slo: Slo,
    samples: SliSample[],
    options: {
        now?: number;
        fastThreshold?: number;
        slowThreshold?: number;
    } = {},
): BurnRateAlertResult {
    const now = options.now ?? Date.now();
    const fastThreshold = options.fastThreshold ?? BURN_RATE_FAST_THRESHOLD;
    const slowThreshold = options.slowThreshold ?? BURN_RATE_SLOW_THRESHOLD;

    const fastSlo: Slo = { ...slo, window: '1h' };
    const slowSlo: Slo = { ...slo, window: '6h' };

    const fastEval = evaluate(fastSlo, windowSamples(samples, '1h', now));
    const slowEval = evaluate(slowSlo, windowSamples(samples, '6h', now));

    const fast: BurnRateWindowAlert = {
        window: '1h',
        burnRate: fastEval.burnRate,
        threshold: fastThreshold,
        triggered: fastEval.burnRate > fastThreshold,
    };
    const slow: BurnRateWindowAlert = {
        window: '6h',
        burnRate: slowEval.burnRate,
        threshold: slowThreshold,
        triggered: slowEval.burnRate > slowThreshold,
    };

    const severity: BurnRateAlert = fast.triggered ? 'fast' : slow.triggered ? 'slow' : 'ok';

    return { severity, fast, slow };
}
