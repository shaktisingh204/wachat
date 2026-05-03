/**
 * Localization, Regions & Tax — shared types.
 *
 * Used across `formatter`, `translate`, `regions`, `currency`, `tax`, and
 * `timezone` helpers. Keep this file dependency-free so it can be imported
 * from edge runtimes and worker contexts.
 */

export type LocaleCode =
    | 'en'
    | 'es'
    | 'fr'
    | 'hi'
    | 'ar'
    | 'zh'
    | 'ja'
    | 'pt'
    | 'de'
    | 'it'
    | 'ru'
    | 'ko'
    | 'tr'
    | 'nl'
    | 'pl'
    | (string & {});

export interface Locale {
    /** BCP-47 code (e.g. `en`, `en-US`, `pt-BR`). */
    code: LocaleCode;
    /** Native (endonym) display name. */
    name: string;
    /** English display name. */
    englishName: string;
    /** Default currency for this locale (ISO 4217). */
    defaultCurrency: string;
    /** Default region for this locale (region key in `regions.ts`). */
    defaultRegion?: RegionKey;
    /** Direction. */
    direction: 'ltr' | 'rtl';
    /** Numeric system (e.g. `latn`, `arab`). */
    numberingSystem?: string;
    /** Whether this locale is enabled in the product. */
    enabled?: boolean;
}

/** Generic translation dictionary. */
export type Translation = Record<string, string>;

export type RegionKey =
    | 'us-east'
    | 'us-west'
    | 'eu-west'
    | 'eu-central'
    | 'in-mumbai'
    | 'ap-singapore'
    | 'ap-sydney'
    | 'sa-brazil';

export interface RegionConfig {
    key: RegionKey;
    label: string;
    /** ISO-3166 country code(s) the region primarily serves. */
    countries: string[];
    /** Cloud provider region identifier (used for storage/queue routing). */
    cloudRegion: string;
    /** Time zone the region operates in (IANA). */
    timezone: string;
    /** Data residency constraints — used by compliance gates. */
    dataResidency: {
        /** If true, customer data MUST stay in this region. */
        strict: boolean;
        /** Allowed jurisdictions for cross-border replication. */
        allowedJurisdictions: string[];
        /** Compliance frameworks honoured by this region. */
        compliance: string[];
    };
    /** Latency target SLO in ms (read p95). */
    latencyTargetMs: number;
}

export interface CurrencyConfig {
    /** ISO 4217 code (uppercase). */
    code: string;
    /** Display symbol. */
    symbol: string;
    /** Native name. */
    name: string;
    /** Default decimal digits. */
    decimals: number;
    /** Whether the symbol leads (USD `$1`) or trails (`1 €`) — UI hint only. */
    symbolPosition?: 'leading' | 'trailing';
}

export type TaxKind =
    | 'vat'
    | 'gst'
    | 'sales_tax'
    | 'hst'
    | 'pst'
    | 'qst'
    | 'none';

export type CustomerType = 'b2c' | 'b2b' | 'b2b_with_vat_id' | 'nonprofit';

export type ProductType =
    | 'digital_service'
    | 'physical_good'
    | 'saas_subscription'
    | 'professional_service'
    | 'food'
    | 'medical'
    | 'education';

export interface TaxRule {
    kind: TaxKind;
    /** ISO-3166 country code (required) — `EU` is allowed for VAT. */
    country: string;
    /** Sub-region (state, province, GST slab key). */
    subRegion?: string;
    /** Decimal rate (e.g. 0.18 → 18%). */
    rate: number;
    /** Optional rate breakdown (CGST/SGST/IGST etc.). */
    breakdown?: Record<string, number>;
    /** Product types this rule applies to. Empty array = applies to all. */
    appliesTo?: ProductType[];
    /** Customer types this rule applies to. Empty/undefined = all. */
    customerTypes?: CustomerType[];
    /** Human-readable label. */
    label: string;
    /** Whether this rule supports the reverse-charge mechanism. */
    reverseCharge?: boolean;
}

export interface TaxCalculationInput {
    amount: number;
    /** ISO-3166 country code OR a region key like `IN-MH`, `US-CA`. */
    region: string;
    productType: ProductType;
    customerType: CustomerType;
    /** Optional currency (defaults to region default — used for rounding). */
    currency?: string;
    /** Override GST slab for India (`5` | `12` | `18` | `28`). */
    gstSlab?: 5 | 12 | 18 | 28;
}

export interface TaxCalculationResult {
    /** Net amount before tax. */
    net: number;
    /** Total tax. */
    tax: number;
    /** Net + tax. */
    gross: number;
    /** Effective rate applied. */
    rate: number;
    kind: TaxKind;
    breakdown: Array<{ label: string; rate: number; amount: number }>;
    /** True when reverse-charge applies and `tax` is shifted to the buyer. */
    reverseCharge: boolean;
    /** Region key resolved from the input. */
    resolvedRegion: string;
}

export interface TimezoneAware {
    /** IANA timezone (e.g. `Asia/Kolkata`). */
    timezone: string;
    /** ISO 8601 instant. */
    at: string;
}
