/**
 * Translation runtime.
 *
 * Translations live in `src/locales/<code>/common.json` as a flat
 * `key -> value` map. We synchronously preload the eight shipped locales so
 * `t()` is non-async and callable from edge contexts. Additional bundles can
 * be plugged in via `registerTranslations`.
 *
 * Lookup order:
 *   1. exact locale (e.g. `pt-BR`)
 *   2. base locale  (e.g. `pt`)
 *   3. fallback     (`en`)
 *   4. raw key (so missing keys are visible in dev)
 */

import type { Translation } from './types';
import { getLocale } from './registry';

import en from '../../locales/en/common.json';
import es from '../../locales/es/common.json';
import fr from '../../locales/fr/common.json';
import hi from '../../locales/hi/common.json';
import ar from '../../locales/ar/common.json';
import zh from '../../locales/zh/common.json';
import ja from '../../locales/ja/common.json';
import pt from '../../locales/pt/common.json';

const BUNDLES = new Map<string, Translation>();

function normalize(code: string): string {
    return code.trim().toLowerCase().replace('_', '-');
}

BUNDLES.set('en', en as Translation);
BUNDLES.set('es', es as Translation);
BUNDLES.set('fr', fr as Translation);
BUNDLES.set('hi', hi as Translation);
BUNDLES.set('ar', ar as Translation);
BUNDLES.set('zh', zh as Translation);
BUNDLES.set('ja', ja as Translation);
BUNDLES.set('pt', pt as Translation);

/** Register or override a translation bundle for a locale. */
export function registerTranslations(locale: string, bundle: Translation): void {
    BUNDLES.set(normalize(locale), { ...(BUNDLES.get(normalize(locale)) ?? {}), ...bundle });
}

/** Returns the merged dictionary for a locale (with fallback to `en`). */
export function getTranslations(locale: string): Translation {
    const code = normalize(getLocale(locale).code);
    const base = code.split('-')[0];
    return {
        ...(BUNDLES.get('en') ?? {}),
        ...(BUNDLES.get(base) ?? {}),
        ...(BUNDLES.get(code) ?? {}),
    };
}

/**
 * Translate a key.
 *
 * Supports `{name}` placeholders and ICU-lite pluralisation:
 *
 *   t('items.count', { count: 3 }, 'en')
 *
 * If the key resolves to a string containing `{count, plural, one {# item} other {# items}}`
 * we honour it via `Intl.PluralRules`.
 */
export function t(
    key: string,
    params: Record<string, string | number> = {},
    locale: string = 'en',
): string {
    const dict = getTranslations(locale);
    let raw = dict[key];
    if (raw == null) raw = key;
    return interpolate(raw, params, locale);
}

const PLURAL_RE = /\{(\w+),\s*plural,\s*([^}]+)\}/g;

function interpolate(template: string, params: Record<string, string | number>, locale: string): string {
    // Pluralisation pass.
    let out = template.replace(PLURAL_RE, (_, name: string, body: string) => {
        const value = Number(params[name] ?? 0);
        const rule = new Intl.PluralRules(getLocale(locale).code).select(value);
        const branches: Record<string, string> = {};
        // Body is `one {# item} other {# items}` — naive split on `}`.
        const re = /(zero|one|two|few|many|other|=\d+)\s*\{([^}]*)\}/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(body)) !== null) {
            branches[m[1]] = m[2];
        }
        const exact = branches[`=${value}`];
        const chosen = exact ?? branches[rule] ?? branches.other ?? '';
        return chosen.replace(/#/g, String(value));
    });
    // Placeholder pass.
    out = out.replace(/\{(\w+)\}/g, (_, name: string) => {
        const v = params[name];
        return v == null ? `{${name}}` : String(v);
    });
    return out;
}

/** Returns true if a key has an explicit translation in the given locale. */
export function hasTranslation(key: string, locale: string): boolean {
    const code = normalize(getLocale(locale).code);
    const base = code.split('-')[0];
    return Boolean(BUNDLES.get(code)?.[key] ?? BUNDLES.get(base)?.[key]);
}
