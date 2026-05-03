/**
 * Currency catalog + FX conversion.
 *
 * The FX-rate snapshot is a static table keyed off USD. In production this
 * file is overwritten daily by the `fx-snapshot` cron worker — keep the shape
 * stable. For unit tests / dev we use an embedded snapshot dated 2025-01-01
 * (mid-market rates from ECB + RBI).
 */

import type { CurrencyConfig } from './types';

export const CURRENCIES: Record<string, CurrencyConfig> = {
    USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2, symbolPosition: 'leading' },
    EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2, symbolPosition: 'trailing' },
    GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2, symbolPosition: 'leading' },
    JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0, symbolPosition: 'leading' },
    CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimals: 2, symbolPosition: 'leading' },
    INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimals: 2, symbolPosition: 'leading' },
    AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimals: 2, symbolPosition: 'leading' },
    CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', decimals: 2, symbolPosition: 'leading' },
    NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', decimals: 2, symbolPosition: 'leading' },
    CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', decimals: 2, symbolPosition: 'trailing' },
    SEK: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', decimals: 2, symbolPosition: 'trailing' },
    NOK: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', decimals: 2, symbolPosition: 'trailing' },
    DKK: { code: 'DKK', symbol: 'kr', name: 'Danish Krone', decimals: 2, symbolPosition: 'trailing' },
    PLN: { code: 'PLN', symbol: 'zł', name: 'Polish Złoty', decimals: 2, symbolPosition: 'trailing' },
    CZK: { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', decimals: 2, symbolPosition: 'trailing' },
    HUF: { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', decimals: 0, symbolPosition: 'trailing' },
    RON: { code: 'RON', symbol: 'lei', name: 'Romanian Leu', decimals: 2, symbolPosition: 'trailing' },
    BGN: { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev', decimals: 2, symbolPosition: 'trailing' },
    HRK: { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna', decimals: 2, symbolPosition: 'trailing' },
    RUB: { code: 'RUB', symbol: '₽', name: 'Russian Ruble', decimals: 2, symbolPosition: 'trailing' },
    TRY: { code: 'TRY', symbol: '₺', name: 'Turkish Lira', decimals: 2, symbolPosition: 'leading' },
    BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', decimals: 2, symbolPosition: 'leading' },
    MXN: { code: 'MXN', symbol: '$', name: 'Mexican Peso', decimals: 2, symbolPosition: 'leading' },
    ARS: { code: 'ARS', symbol: '$', name: 'Argentine Peso', decimals: 2, symbolPosition: 'leading' },
    CLP: { code: 'CLP', symbol: '$', name: 'Chilean Peso', decimals: 0, symbolPosition: 'leading' },
    COP: { code: 'COP', symbol: '$', name: 'Colombian Peso', decimals: 2, symbolPosition: 'leading' },
    PEN: { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', decimals: 2, symbolPosition: 'leading' },
    UYU: { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso', decimals: 2, symbolPosition: 'leading' },
    ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand', decimals: 2, symbolPosition: 'leading' },
    NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', decimals: 2, symbolPosition: 'leading' },
    KES: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', decimals: 2, symbolPosition: 'leading' },
    EGP: { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', decimals: 2, symbolPosition: 'leading' },
    MAD: { code: 'MAD', symbol: 'د.م.', name: 'Moroccan Dirham', decimals: 2, symbolPosition: 'trailing' },
    AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', decimals: 2, symbolPosition: 'trailing' },
    SAR: { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', decimals: 2, symbolPosition: 'trailing' },
    QAR: { code: 'QAR', symbol: '﷼', name: 'Qatari Riyal', decimals: 2, symbolPosition: 'trailing' },
    KWD: { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', decimals: 3, symbolPosition: 'trailing' },
    BHD: { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar', decimals: 3, symbolPosition: 'trailing' },
    OMR: { code: 'OMR', symbol: '﷼', name: 'Omani Rial', decimals: 3, symbolPosition: 'trailing' },
    JOD: { code: 'JOD', symbol: 'د.ا', name: 'Jordanian Dinar', decimals: 3, symbolPosition: 'trailing' },
    ILS: { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', decimals: 2, symbolPosition: 'leading' },
    IRR: { code: 'IRR', symbol: '﷼', name: 'Iranian Rial', decimals: 2, symbolPosition: 'trailing' },
    PKR: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', decimals: 2, symbolPosition: 'leading' },
    BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', decimals: 2, symbolPosition: 'leading' },
    LKR: { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', decimals: 2, symbolPosition: 'leading' },
    NPR: { code: 'NPR', symbol: '₨', name: 'Nepalese Rupee', decimals: 2, symbolPosition: 'leading' },
    THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', decimals: 2, symbolPosition: 'leading' },
    SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', decimals: 2, symbolPosition: 'leading' },
    MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', decimals: 2, symbolPosition: 'leading' },
    IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', decimals: 0, symbolPosition: 'leading' },
    PHP: { code: 'PHP', symbol: '₱', name: 'Philippine Peso', decimals: 2, symbolPosition: 'leading' },
    VND: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', decimals: 0, symbolPosition: 'trailing' },
    KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', decimals: 0, symbolPosition: 'leading' },
    HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', decimals: 2, symbolPosition: 'leading' },
    TWD: { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar', decimals: 2, symbolPosition: 'leading' },
};

/** Static FX rate snapshot — units of currency per **1 USD**. */
const FX_USD_RATES: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.78,
    JPY: 149.5,
    CNY: 7.18,
    INR: 83.2,
    AUD: 1.52,
    CAD: 1.35,
    NZD: 1.65,
    CHF: 0.88,
    SEK: 10.4,
    NOK: 10.6,
    DKK: 6.85,
    PLN: 4.0,
    CZK: 23.1,
    HUF: 355,
    RON: 4.55,
    BGN: 1.79,
    HRK: 6.92,
    RUB: 90,
    TRY: 30.5,
    BRL: 4.95,
    MXN: 17.2,
    ARS: 850,
    CLP: 925,
    COP: 4050,
    PEN: 3.78,
    UYU: 39.5,
    ZAR: 18.5,
    NGN: 1500,
    KES: 130,
    EGP: 49,
    MAD: 9.95,
    AED: 3.6725,
    SAR: 3.75,
    QAR: 3.64,
    KWD: 0.31,
    BHD: 0.376,
    OMR: 0.385,
    JOD: 0.71,
    ILS: 3.65,
    IRR: 42000,
    PKR: 280,
    BDT: 110,
    LKR: 320,
    NPR: 133,
    THB: 35.5,
    SGD: 1.34,
    MYR: 4.7,
    IDR: 15600,
    PHP: 56,
    VND: 24500,
    KRW: 1330,
    HKD: 7.83,
    TWD: 32,
};

export interface FxSnapshot {
    /** ISO date the snapshot was captured. */
    date: string;
    /** Per-currency rate vs USD. */
    rates: Record<string, number>;
}

let CURRENT_SNAPSHOT: FxSnapshot = {
    date: '2025-01-01',
    rates: { ...FX_USD_RATES },
};

/** Replace the active FX snapshot (called by the cron worker). */
export function setFxSnapshot(snapshot: FxSnapshot): void {
    CURRENT_SNAPSHOT = {
        date: snapshot.date,
        rates: { ...snapshot.rates, USD: 1 },
    };
}

export function getFxSnapshot(): FxSnapshot {
    return { date: CURRENT_SNAPSHOT.date, rates: { ...CURRENT_SNAPSHOT.rates } };
}

export interface ConvertOptions {
    /** Override the snapshot (for deterministic tests). */
    snapshot?: FxSnapshot;
    /** Round to the destination currency's decimal places (default: true). */
    round?: boolean;
}

/**
 * Convert `amount` from `from` → `to` using the active FX snapshot.
 *
 * Conversion is performed in USD-space: `amount / fx[from] * fx[to]`. If
 * either currency is unknown we throw — this is intentional, callers should
 * have validated the codes upstream.
 */
export function convert(
    amount: number,
    from: string,
    to: string,
    options: ConvertOptions = {},
): number {
    if (!Number.isFinite(amount)) throw new TypeError('amount must be finite');
    const f = (from || '').toUpperCase();
    const t = (to || '').toUpperCase();
    const rates = (options.snapshot ?? CURRENT_SNAPSHOT).rates;
    const fromRate = rates[f];
    const toRate = rates[t];
    if (fromRate == null) throw new Error(`Unknown currency: ${f}`);
    if (toRate == null) throw new Error(`Unknown currency: ${t}`);

    if (f === t) return options.round === false ? amount : roundTo(amount, t);

    const usd = amount / fromRate;
    const out = usd * toRate;
    return options.round === false ? out : roundTo(out, t);
}

function roundTo(value: number, currency: string): number {
    const decimals = CURRENCIES[currency]?.decimals ?? 2;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

export function getCurrency(code: string): CurrencyConfig | undefined {
    return CURRENCIES[code.toUpperCase()];
}

export function listCurrencies(): CurrencyConfig[] {
    return Object.values(CURRENCIES);
}
