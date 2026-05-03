/**
 * Locale-aware formatters built on the `Intl` API.
 *
 * Every helper accepts an optional locale code; when omitted we fall back to
 * `en`. Formatter instances are cached per locale/options bucket because
 * `Intl.*Format` constructors are noticeably expensive on hot paths.
 */

import { getLocale } from './registry';

type CacheKey = string;
const NUMBER_CACHE = new Map<CacheKey, Intl.NumberFormat>();
const DATE_CACHE = new Map<CacheKey, Intl.DateTimeFormat>();
const PLURAL_CACHE = new Map<CacheKey, Intl.PluralRules>();
const RELATIVE_CACHE = new Map<CacheKey, Intl.RelativeTimeFormat>();

function resolveLocale(locale?: string): string {
    return getLocale(locale).code;
}

function key(locale: string, options: object): CacheKey {
    return locale + '|' + JSON.stringify(options);
}

export interface FormatNumberOptions extends Intl.NumberFormatOptions {
    locale?: string;
}

export function formatNumber(value: number, options: FormatNumberOptions = {}): string {
    const { locale, ...rest } = options;
    const code = resolveLocale(locale);
    const k = key(code, rest);
    let f = NUMBER_CACHE.get(k);
    if (!f) {
        f = new Intl.NumberFormat(code, rest);
        NUMBER_CACHE.set(k, f);
    }
    return f.format(value);
}

export interface FormatDateOptions extends Intl.DateTimeFormatOptions {
    locale?: string;
}

export function formatDate(value: Date | number | string, options: FormatDateOptions = {}): string {
    const { locale, ...rest } = options;
    const code = resolveLocale(locale);
    const k = key(code, rest);
    let f = DATE_CACHE.get(k);
    if (!f) {
        f = new Intl.DateTimeFormat(code, rest);
        DATE_CACHE.set(k, f);
    }
    const date = value instanceof Date ? value : new Date(value);
    return f.format(date);
}

export interface FormatCurrencyOptions extends Omit<Intl.NumberFormatOptions, 'style' | 'currency'> {
    locale?: string;
    /** Override the currency (defaults to the locale's default). */
    currency?: string;
    /** Force display style. */
    currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
}

export function formatCurrency(value: number, options: FormatCurrencyOptions = {}): string {
    const { locale, currency, currencyDisplay = 'symbol', ...rest } = options;
    const resolved = getLocale(locale);
    const ccy = (currency ?? resolved.defaultCurrency).toUpperCase();
    const opts: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: ccy,
        currencyDisplay,
        ...rest,
    };
    const k = key(resolved.code, opts);
    let f = NUMBER_CACHE.get(k);
    if (!f) {
        f = new Intl.NumberFormat(resolved.code, opts);
        NUMBER_CACHE.set(k, f);
    }
    return f.format(value);
}

export interface FormatPluralOptions {
    locale?: string;
    type?: 'cardinal' | 'ordinal';
}

/**
 * Returns the plural category (`zero | one | two | few | many | other`)
 * for `value` in the given locale. Use this with a CLDR-style message map.
 */
export function formatPlural(value: number, options: FormatPluralOptions = {}): Intl.LDMLPluralRule {
    const { locale, type = 'cardinal' } = options;
    const code = resolveLocale(locale);
    const k = key(code, { type });
    let f = PLURAL_CACHE.get(k);
    if (!f) {
        f = new Intl.PluralRules(code, { type });
        PLURAL_CACHE.set(k, f);
    }
    return f.select(value) as Intl.LDMLPluralRule;
}

export type RelativeUnit =
    | 'year'
    | 'quarter'
    | 'month'
    | 'week'
    | 'day'
    | 'hour'
    | 'minute'
    | 'second';

export interface FormatRelativeTimeOptions extends Intl.RelativeTimeFormatOptions {
    locale?: string;
}

export function formatRelativeTime(
    value: number,
    unit: RelativeUnit,
    options: FormatRelativeTimeOptions = {},
): string {
    const { locale, numeric = 'auto', style = 'long', ...rest } = options;
    const code = resolveLocale(locale);
    const opts: Intl.RelativeTimeFormatOptions = { numeric, style, ...rest };
    const k = key(code, opts);
    let f = RELATIVE_CACHE.get(k);
    if (!f) {
        f = new Intl.RelativeTimeFormat(code, opts);
        RELATIVE_CACHE.set(k, f);
    }
    return f.format(value, unit);
}

/** Convenience: relative time from `from` to `to` (defaults to now). */
export function formatRelativeFromNow(
    target: Date | number | string,
    options: FormatRelativeTimeOptions = {},
): string {
    const ts = target instanceof Date ? target.getTime() : new Date(target).getTime();
    const diffMs = ts - Date.now();
    const abs = Math.abs(diffMs);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;
    const year = 365 * day;

    let unit: RelativeUnit;
    let value: number;
    if (abs < minute) {
        unit = 'second';
        value = Math.round(diffMs / 1000);
    } else if (abs < hour) {
        unit = 'minute';
        value = Math.round(diffMs / minute);
    } else if (abs < day) {
        unit = 'hour';
        value = Math.round(diffMs / hour);
    } else if (abs < week) {
        unit = 'day';
        value = Math.round(diffMs / day);
    } else if (abs < month) {
        unit = 'week';
        value = Math.round(diffMs / week);
    } else if (abs < year) {
        unit = 'month';
        value = Math.round(diffMs / month);
    } else {
        unit = 'year';
        value = Math.round(diffMs / year);
    }
    return formatRelativeTime(value, unit, options);
}
