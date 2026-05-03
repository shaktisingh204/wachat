/**
 * Tax — minimal region-table calculator.
 *
 * Returns tax on a pre-tax amount in minor units. The lookup table is
 * intentionally simple so this can be swapped for Stripe Tax, Avalara, or
 * TaxJar without touching call sites — the public signature only depends on
 * `{tenantId, amount, region}`.
 *
 * Rates are illustrative defaults; jurisdictions like US states and EU VAT
 * should be sourced from a live provider in production.
 */

export interface TaxInput {
    tenantId: string;
    /** Pre-tax amount in minor units (cents/paise). */
    amount: number;
    /** ISO-3166-1 alpha-2 country code, optionally `:STATE` (e.g. `US:CA`). */
    region: string;
}

const REGION_RATES: Record<string, number> = {
    // Country-level defaults.
    US: 0, // US tax is sub-national; default 0 unless state included.
    CA: 0.05, // GST baseline.
    GB: 0.2, // VAT.
    DE: 0.19,
    FR: 0.2,
    ES: 0.21,
    IT: 0.22,
    NL: 0.21,
    IE: 0.23,
    AU: 0.1, // GST.
    NZ: 0.15,
    SG: 0.09,
    AE: 0.05,
    JP: 0.1,
    IN: 0.18, // GST default for SaaS.

    // Selected US states (sales tax on digital goods, illustrative).
    'US:CA': 0.0725,
    'US:NY': 0.04,
    'US:TX': 0.0625,
    'US:WA': 0.065,
    'US:FL': 0.06,

    // Selected Canadian provinces (HST/GST+PST).
    'CA:ON': 0.13,
    'CA:BC': 0.12,
    'CA:QC': 0.14975,
};

/**
 * Resolve the effective rate for a region string, falling back from
 * `COUNTRY:STATE` to `COUNTRY` to 0.
 */
function rateFor(region: string): number {
    if (!region) return 0;
    const upper = region.toUpperCase();
    if (REGION_RATES[upper] !== undefined) return REGION_RATES[upper];
    const country = upper.split(':')[0];
    return REGION_RATES[country] ?? 0;
}

export function calculateTax({ amount, region }: TaxInput): number {
    if (!Number.isFinite(amount)) {
        throw new Error('amount must be finite');
    }
    if (amount <= 0) return 0;

    const rate = rateFor(region);
    if (rate <= 0) return 0;

    // Round half-away-from-zero to integer minor units.
    return Math.round(amount * rate);
}

/**
 * Return rate + computed tax in one call — useful for invoice rendering.
 */
export function taxBreakdown(input: TaxInput): {
    rate: number;
    taxCents: number;
    grossCents: number;
} {
    const rate = rateFor(input.region);
    const taxCents = calculateTax(input);
    return {
        rate,
        taxCents,
        grossCents: input.amount + taxCents,
    };
}
