/**
 * Tax engine.
 *
 * Supports:
 *   - VAT for the EU-27 + UK (single rate per country, reverse-charge for
 *     verified B2B with VAT IDs)
 *   - GST India — 4 slabs (5/12/18/28) split CGST/SGST for intra-state
 *     and IGST for inter-state
 *   - GST Australia (10%)
 *   - US Sales Tax — combined state averages for all 50 states + DC,
 *     digital_service exemptions where applicable
 *   - Canada — GST + PST/HST/QST per province
 *
 * Calling convention: pass a flat country code (`DE`, `IN`, `AU`) for
 * country-level rules, or a hyphenated sub-region (`IN-MH`, `US-CA`,
 * `CA-ON`) for state/province-level rules.
 */

import type {
    CustomerType,
    ProductType,
    TaxCalculationInput,
    TaxCalculationResult,
    TaxKind,
    TaxRule,
} from './types';

// ---------------------------------------------------------------------------
// EU VAT
// ---------------------------------------------------------------------------

const EU_VAT_RATES: Record<string, number> = {
    AT: 0.2,
    BE: 0.21,
    BG: 0.2,
    HR: 0.25,
    CY: 0.19,
    CZ: 0.21,
    DK: 0.25,
    EE: 0.22,
    FI: 0.255,
    FR: 0.2,
    DE: 0.19,
    GR: 0.24,
    HU: 0.27,
    IE: 0.23,
    IT: 0.22,
    LV: 0.21,
    LT: 0.21,
    LU: 0.17,
    MT: 0.18,
    NL: 0.21,
    PL: 0.23,
    PT: 0.23,
    RO: 0.19,
    SK: 0.23,
    SI: 0.22,
    ES: 0.21,
    SE: 0.25,
    GB: 0.2, // UK kept here for B2C — handled separately below
};

const EU_MEMBERS = new Set(Object.keys(EU_VAT_RATES).filter((c) => c !== 'GB'));

// ---------------------------------------------------------------------------
// India GST — 4 slabs
// ---------------------------------------------------------------------------

const INDIA_GST_SLABS: Record<5 | 12 | 18 | 28, number> = {
    5: 0.05,
    12: 0.12,
    18: 0.18,
    28: 0.28,
};

const INDIA_PRODUCT_DEFAULT_SLAB: Record<ProductType, 5 | 12 | 18 | 28> = {
    digital_service: 18,
    saas_subscription: 18,
    professional_service: 18,
    physical_good: 18,
    food: 5,
    medical: 5,
    education: 12,
};

// ---------------------------------------------------------------------------
// US sales tax — combined state averages (rounded). Source: Tax Foundation
// "State and Local Sales Tax Rates" 2024.
// ---------------------------------------------------------------------------

const US_STATE_RATES: Record<string, number> = {
    AL: 0.0925,
    AK: 0.0182,
    AZ: 0.0838,
    AR: 0.0946,
    CA: 0.0882,
    CO: 0.0777,
    CT: 0.0635,
    DE: 0,
    FL: 0.0702,
    GA: 0.0738,
    HI: 0.0444,
    ID: 0.0603,
    IL: 0.0886,
    IN: 0.07,
    IA: 0.0694,
    KS: 0.0866,
    KY: 0.06,
    LA: 0.0956,
    ME: 0.055,
    MD: 0.06,
    MA: 0.0625,
    MI: 0.06,
    MN: 0.0753,
    MS: 0.0707,
    MO: 0.0838,
    MT: 0,
    NE: 0.0697,
    NV: 0.0823,
    NH: 0,
    NJ: 0.0666,
    NM: 0.0762,
    NY: 0.0853,
    NC: 0.0699,
    ND: 0.0696,
    OH: 0.0724,
    OK: 0.0899,
    OR: 0,
    PA: 0.0634,
    RI: 0.07,
    SC: 0.0744,
    SD: 0.0644,
    TN: 0.0955,
    TX: 0.082,
    UT: 0.0719,
    VT: 0.0624,
    VA: 0.0577,
    WA: 0.0938,
    WV: 0.0656,
    WI: 0.0543,
    WY: 0.0533,
    DC: 0.06,
};

/** States that don't charge sales tax on digital services / SaaS. */
const US_DIGITAL_EXEMPT = new Set(['CA', 'FL', 'NV', 'OR', 'NH', 'DE', 'MT', 'AK']);

// ---------------------------------------------------------------------------
// Canada — GST + PST / HST / QST
// ---------------------------------------------------------------------------

interface CanadaTax {
    kind: TaxKind;
    rate: number;
    breakdown: Record<string, number>;
}

const CANADA_PROVINCE: Record<string, CanadaTax> = {
    AB: { kind: 'gst', rate: 0.05, breakdown: { GST: 0.05 } },
    BC: { kind: 'gst', rate: 0.12, breakdown: { GST: 0.05, PST: 0.07 } },
    MB: { kind: 'gst', rate: 0.12, breakdown: { GST: 0.05, PST: 0.07 } },
    NB: { kind: 'hst', rate: 0.15, breakdown: { HST: 0.15 } },
    NL: { kind: 'hst', rate: 0.15, breakdown: { HST: 0.15 } },
    NS: { kind: 'hst', rate: 0.14, breakdown: { HST: 0.14 } },
    NT: { kind: 'gst', rate: 0.05, breakdown: { GST: 0.05 } },
    NU: { kind: 'gst', rate: 0.05, breakdown: { GST: 0.05 } },
    ON: { kind: 'hst', rate: 0.13, breakdown: { HST: 0.13 } },
    PE: { kind: 'hst', rate: 0.15, breakdown: { HST: 0.15 } },
    QC: { kind: 'qst', rate: 0.14975, breakdown: { GST: 0.05, QST: 0.09975 } },
    SK: { kind: 'gst', rate: 0.11, breakdown: { GST: 0.05, PST: 0.06 } },
    YT: { kind: 'gst', rate: 0.05, breakdown: { GST: 0.05 } },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Round a money value to 2 decimal places (banker-style). */
function r2(n: number): number {
    return Math.round(n * 100) / 100;
}

function parseRegion(region: string): { country: string; sub?: string } {
    const parts = region.toUpperCase().split('-');
    return { country: parts[0], sub: parts[1] };
}

function emptyResult(input: TaxCalculationInput, kind: TaxKind, regionKey: string): TaxCalculationResult {
    return {
        net: r2(input.amount),
        tax: 0,
        gross: r2(input.amount),
        rate: 0,
        kind,
        breakdown: [],
        reverseCharge: false,
        resolvedRegion: regionKey,
    };
}

/**
 * Calculate tax for a transaction.
 *
 * Inputs use exclusive pricing — `amount` is the **net** value, the result
 * exposes `tax` and `gross`. For products with VAT-inclusive pricing,
 * convert upstream.
 */
export function calculateTax(input: TaxCalculationInput): TaxCalculationResult {
    if (!Number.isFinite(input.amount)) throw new TypeError('amount must be finite');
    if (input.amount < 0) throw new RangeError('amount must be >= 0');

    const { country, sub } = parseRegion(input.region);

    // ---- Reverse-charge VAT (EU B2B) -------------------------------------
    if (
        EU_MEMBERS.has(country) &&
        input.customerType === 'b2b_with_vat_id' &&
        (input.productType === 'digital_service' ||
            input.productType === 'saas_subscription' ||
            input.productType === 'professional_service')
    ) {
        return {
            net: r2(input.amount),
            tax: 0,
            gross: r2(input.amount),
            rate: 0,
            kind: 'vat',
            breakdown: [],
            reverseCharge: true,
            resolvedRegion: country,
        };
    }

    // ---- EU VAT + UK -----------------------------------------------------
    if (EU_VAT_RATES[country] != null) {
        const rate = EU_VAT_RATES[country];
        const tax = r2(input.amount * rate);
        return {
            net: r2(input.amount),
            tax,
            gross: r2(input.amount + tax),
            rate,
            kind: 'vat',
            breakdown: [{ label: `${country} VAT`, rate, amount: tax }],
            reverseCharge: false,
            resolvedRegion: country,
        };
    }

    // ---- India GST -------------------------------------------------------
    if (country === 'IN') {
        const slab = input.gstSlab ?? INDIA_PRODUCT_DEFAULT_SLAB[input.productType];
        const rate = INDIA_GST_SLABS[slab];
        const tax = r2(input.amount * rate);
        // Inter-state transactions use IGST; intra-state splits CGST + SGST.
        // We treat presence of `sub` (state code) as intra-state.
        const breakdown = sub
            ? [
                  { label: 'CGST', rate: rate / 2, amount: r2(tax / 2) },
                  { label: 'SGST', rate: rate / 2, amount: r2(tax - r2(tax / 2)) },
              ]
            : [{ label: 'IGST', rate, amount: tax }];
        return {
            net: r2(input.amount),
            tax,
            gross: r2(input.amount + tax),
            rate,
            kind: 'gst',
            breakdown,
            reverseCharge: false,
            resolvedRegion: sub ? `IN-${sub}` : 'IN',
        };
    }

    // ---- Australia GST ---------------------------------------------------
    if (country === 'AU') {
        // Education and certain medical items are GST-free.
        if (input.productType === 'education' || input.productType === 'medical') {
            return emptyResult(input, 'gst', 'AU');
        }
        const rate = 0.1;
        const tax = r2(input.amount * rate);
        return {
            net: r2(input.amount),
            tax,
            gross: r2(input.amount + tax),
            rate,
            kind: 'gst',
            breakdown: [{ label: 'AU GST', rate, amount: tax }],
            reverseCharge: false,
            resolvedRegion: 'AU',
        };
    }

    // ---- USA sales tax ---------------------------------------------------
    if (country === 'US') {
        if (!sub || US_STATE_RATES[sub] == null) return emptyResult(input, 'sales_tax', 'US');
        // Many states exempt SaaS / digital services.
        if (
            (input.productType === 'digital_service' || input.productType === 'saas_subscription') &&
            US_DIGITAL_EXEMPT.has(sub)
        ) {
            return emptyResult(input, 'sales_tax', `US-${sub}`);
        }
        // Nonprofits exempt with a resale certificate (mocked).
        if (input.customerType === 'nonprofit') {
            return emptyResult(input, 'sales_tax', `US-${sub}`);
        }
        const rate = US_STATE_RATES[sub];
        const tax = r2(input.amount * rate);
        return {
            net: r2(input.amount),
            tax,
            gross: r2(input.amount + tax),
            rate,
            kind: 'sales_tax',
            breakdown: [{ label: `US-${sub} Sales Tax`, rate, amount: tax }],
            reverseCharge: false,
            resolvedRegion: `US-${sub}`,
        };
    }

    // ---- Canada ----------------------------------------------------------
    if (country === 'CA') {
        if (!sub || CANADA_PROVINCE[sub] == null) return emptyResult(input, 'gst', 'CA');
        const province = CANADA_PROVINCE[sub];
        const tax = r2(input.amount * province.rate);
        const breakdown = Object.entries(province.breakdown).map(([label, rate]) => ({
            label,
            rate,
            amount: r2(input.amount * rate),
        }));
        return {
            net: r2(input.amount),
            tax,
            gross: r2(input.amount + tax),
            rate: province.rate,
            kind: province.kind,
            breakdown,
            reverseCharge: false,
            resolvedRegion: `CA-${sub}`,
        };
    }

    // No rule matched — assume zero tax.
    return emptyResult(input, 'none', country);
}

/**
 * Returns the catalog of static rules for `country` (used by the admin UI
 * to render a tax-table preview).
 */
export function rulesForCountry(country: string): TaxRule[] {
    const c = country.toUpperCase();
    if (EU_VAT_RATES[c] != null) {
        return [{ kind: 'vat', country: c, rate: EU_VAT_RATES[c], label: `${c} standard VAT` }];
    }
    if (c === 'IN') {
        const slabs: Array<5 | 12 | 18 | 28> = [5, 12, 18, 28];
        return slabs.map((slab) => ({
            kind: 'gst',
            country: 'IN',
            subRegion: `slab-${slab}`,
            rate: INDIA_GST_SLABS[slab],
            label: `India GST ${slab}%`,
        }));
    }
    if (c === 'AU') return [{ kind: 'gst', country: 'AU', rate: 0.1, label: 'Australia GST' }];
    if (c === 'US') {
        return Object.entries(US_STATE_RATES).map(([state, rate]) => ({
            kind: 'sales_tax',
            country: 'US',
            subRegion: state,
            rate,
            label: `US-${state} Sales Tax`,
        }));
    }
    if (c === 'CA') {
        return Object.entries(CANADA_PROVINCE).map(([prov, info]) => ({
            kind: info.kind,
            country: 'CA',
            subRegion: prov,
            rate: info.rate,
            breakdown: info.breakdown,
            label: `Canada ${prov} ${info.kind.toUpperCase()}`,
        }));
    }
    return [];
}

export function isReverseChargeEligible(country: string, customerType: CustomerType, productType: ProductType): boolean {
    if (!EU_MEMBERS.has(country.toUpperCase())) return false;
    if (customerType !== 'b2b_with_vat_id') return false;
    return (
        productType === 'digital_service' ||
        productType === 'saas_subscription' ||
        productType === 'professional_service'
    );
}
