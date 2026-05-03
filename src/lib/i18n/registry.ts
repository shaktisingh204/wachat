/**
 * Locale registry — backs `availableLocales`, `getLocale`, and `registerLocale`.
 *
 * The registry seeds the eight locales we ship translations for (see
 * `src/locales/`) plus a handful of common European locales that fall back
 * to English at runtime. Callers can register additional locales at boot
 * (for example, white-label tenants).
 */

import type { Locale, LocaleCode } from './types';

const REGISTRY = new Map<string, Locale>();

const SEED: Locale[] = [
    {
        code: 'en',
        name: 'English',
        englishName: 'English',
        defaultCurrency: 'USD',
        defaultRegion: 'us-east',
        direction: 'ltr',
        enabled: true,
    },
    {
        code: 'es',
        name: 'Español',
        englishName: 'Spanish',
        defaultCurrency: 'EUR',
        defaultRegion: 'eu-west',
        direction: 'ltr',
        enabled: true,
    },
    {
        code: 'fr',
        name: 'Français',
        englishName: 'French',
        defaultCurrency: 'EUR',
        defaultRegion: 'eu-west',
        direction: 'ltr',
        enabled: true,
    },
    {
        code: 'hi',
        name: 'हिन्दी',
        englishName: 'Hindi',
        defaultCurrency: 'INR',
        defaultRegion: 'in-mumbai',
        direction: 'ltr',
        enabled: true,
    },
    {
        code: 'ar',
        name: 'العربية',
        englishName: 'Arabic',
        defaultCurrency: 'AED',
        defaultRegion: 'eu-central',
        direction: 'rtl',
        enabled: true,
    },
    {
        code: 'zh',
        name: '中文',
        englishName: 'Chinese (Simplified)',
        defaultCurrency: 'CNY',
        defaultRegion: 'ap-singapore',
        direction: 'ltr',
        enabled: true,
    },
    {
        code: 'ja',
        name: '日本語',
        englishName: 'Japanese',
        defaultCurrency: 'JPY',
        defaultRegion: 'ap-singapore',
        direction: 'ltr',
        enabled: true,
    },
    {
        code: 'pt',
        name: 'Português',
        englishName: 'Portuguese',
        defaultCurrency: 'BRL',
        defaultRegion: 'sa-brazil',
        direction: 'ltr',
        enabled: true,
    },
    {
        code: 'de',
        name: 'Deutsch',
        englishName: 'German',
        defaultCurrency: 'EUR',
        defaultRegion: 'eu-central',
        direction: 'ltr',
        enabled: false,
    },
    {
        code: 'it',
        name: 'Italiano',
        englishName: 'Italian',
        defaultCurrency: 'EUR',
        defaultRegion: 'eu-west',
        direction: 'ltr',
        enabled: false,
    },
    {
        code: 'he',
        name: 'עברית',
        englishName: 'Hebrew',
        defaultCurrency: 'ILS',
        defaultRegion: 'eu-central',
        direction: 'rtl',
        enabled: false,
    },
    {
        code: 'fa',
        name: 'فارسی',
        englishName: 'Persian',
        defaultCurrency: 'IRR',
        defaultRegion: 'eu-central',
        direction: 'rtl',
        enabled: false,
    },
    {
        code: 'ur',
        name: 'اردو',
        englishName: 'Urdu',
        defaultCurrency: 'PKR',
        defaultRegion: 'in-mumbai',
        direction: 'rtl',
        enabled: false,
    },
];

for (const locale of SEED) {
    REGISTRY.set(normalize(locale.code), locale);
}

function normalize(code: string): string {
    return code.trim().toLowerCase().replace('_', '-');
}

/** Register or override a locale. */
export function registerLocale(locale: Locale): Locale {
    const key = normalize(locale.code);
    REGISTRY.set(key, { ...locale, code: key });
    return REGISTRY.get(key)!;
}

/**
 * Resolve a locale by code. Falls back from `pt-BR` → `pt` → `en` so callers
 * always get a usable record.
 */
export function getLocale(code: string | null | undefined): Locale {
    if (!code) return REGISTRY.get('en')!;
    const key = normalize(code);
    if (REGISTRY.has(key)) return REGISTRY.get(key)!;
    const base = key.split('-')[0];
    if (REGISTRY.has(base)) return REGISTRY.get(base)!;
    return REGISTRY.get('en')!;
}

/** Returns all registered locales (enabled-first). */
export function availableLocales(options?: { enabledOnly?: boolean }): Locale[] {
    const all = Array.from(REGISTRY.values());
    const filtered = options?.enabledOnly ? all.filter((l) => l.enabled) : all;
    return filtered.sort((a, b) => {
        if (!!a.enabled !== !!b.enabled) return a.enabled ? -1 : 1;
        return a.englishName.localeCompare(b.englishName);
    });
}

/** Mostly used by tests — clears any non-seed registrations. */
export function resetLocaleRegistry(): void {
    REGISTRY.clear();
    for (const locale of SEED) REGISTRY.set(normalize(locale.code), locale);
}

/** Type guard. */
export function isLocaleCode(code: unknown): code is LocaleCode {
    return typeof code === 'string' && REGISTRY.has(normalize(code));
}
