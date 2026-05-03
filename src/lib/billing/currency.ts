/**
 * Currency conversion via a snapshot of FX rates.
 *
 * Rates are stored relative to USD. A rate of `0.92` for EUR means 1 USD =
 * 0.92 EUR. The snapshot is intentionally embedded so this module works in
 * edge runtimes; `setRates()` can refresh from a daily cron pulling
 * exchangerate.host or OpenExchangeRates.
 *
 * All amounts are in minor units (cents) — conversion preserves minor-unit
 * granularity by rounding half-away-from-zero.
 */

import type { Currency } from './types';

let RATES: Record<Currency, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    INR: 83.2,
    AUD: 1.52,
    CAD: 1.36,
    SGD: 1.34,
    AED: 3.67,
    JPY: 152.5,
};

/**
 * Last update timestamp for the cached rate snapshot.
 */
let RATES_UPDATED_AT: string = new Date(0).toISOString();

export function setRates(
    rates: Partial<Record<Currency, number>>,
    updatedAt: string = new Date().toISOString(),
): void {
    RATES = { ...RATES, ...rates };
    RATES_UPDATED_AT = updatedAt;
}

export function getRates(): {
    rates: Record<Currency, number>;
    updatedAt: string;
} {
    return { rates: { ...RATES }, updatedAt: RATES_UPDATED_AT };
}

/**
 * Convert a minor-unit amount from one currency to another using the active
 * rate snapshot. Same-currency conversions short-circuit.
 */
export function convert(amount: number, from: Currency, to: Currency): number {
    if (!Number.isFinite(amount)) {
        throw new Error('amount must be finite');
    }
    if (from === to) return Math.round(amount);

    const fromRate = RATES[from];
    const toRate = RATES[to];
    if (fromRate === undefined) throw new Error(`Unknown currency: ${from}`);
    if (toRate === undefined) throw new Error(`Unknown currency: ${to}`);

    // Convert to USD base, then to target.
    const usd = amount / fromRate;
    const target = usd * toRate;

    return target >= 0 ? Math.round(target) : -Math.round(-target);
}
