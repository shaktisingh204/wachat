/**
 * Proration — plan upgrade / downgrade math.
 *
 * Returns the delta (in minor units / cents) the tenant should be charged or
 * credited when switching plans mid-period. Mirrors Stripe's classic
 * proration model:
 *
 *   credit_unused_old = oldPlanPrice * (daysRemaining / daysInPeriod)
 *   charge_new        = newPlanPrice * (daysRemaining / daysInPeriod)
 *   delta             = charge_new - credit_unused_old
 *
 * A negative delta means a credit is owed to the customer.
 */

import type { Plan } from './types';

export function prorate(
    currentPlan: Plan,
    newPlan: Plan,
    daysRemaining: number,
    daysInPeriod: number,
): number {
    if (!Number.isFinite(daysRemaining) || daysRemaining < 0) {
        throw new Error('daysRemaining must be a non-negative finite number');
    }
    if (!Number.isFinite(daysInPeriod) || daysInPeriod <= 0) {
        throw new Error('daysInPeriod must be a positive finite number');
    }
    if (daysRemaining > daysInPeriod) {
        throw new Error('daysRemaining cannot exceed daysInPeriod');
    }

    if (currentPlan.currency !== newPlan.currency) {
        throw new Error(
            `Cannot prorate across currencies (${currentPlan.currency} -> ${newPlan.currency}); convert first via currency.convert`,
        );
    }

    const ratio = daysRemaining / daysInPeriod;
    const creditUnusedOld = currentPlan.priceCents * ratio;
    const chargeNewPortion = newPlan.priceCents * ratio;
    const delta = chargeNewPortion - creditUnusedOld;

    // Round half-away-from-zero to keep ledger entries on integer minor units.
    return delta >= 0 ? Math.round(delta) : -Math.round(-delta);
}

/**
 * Helper: given an ISO period start/end and "now", return integers suitable
 * for `prorate`.
 */
export function daysRemainingInPeriod(
    periodStartIso: string,
    periodEndIso: string,
    now: Date = new Date(),
): { daysRemaining: number; daysInPeriod: number } {
    const start = new Date(periodStartIso).getTime();
    const end = new Date(periodEndIso).getTime();
    const t = now.getTime();

    const ms = 24 * 60 * 60 * 1000;
    const daysInPeriod = Math.max(1, Math.round((end - start) / ms));
    const daysRemaining = Math.max(0, Math.min(daysInPeriod, Math.round((end - t) / ms)));

    return { daysRemaining, daysInPeriod };
}
