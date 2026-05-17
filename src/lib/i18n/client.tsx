'use client';

/**
 * Client-side i18n bridge — pairs with `src/lib/i18n/server.ts`.
 *
 * Why this exists:
 *   The raw `t()` in `translate.ts` is locale-agnostic — every call
 *   requires an explicit locale string. That's correct for a low-level
 *   primitive but tedious in components. This module wraps it in a React
 *   provider so any client component under the dashboard layout can call
 *   `const { t } = useT();` without threading the locale by hand.
 *
 * The provider is hydrated from the server (via the dashboard layout)
 * with the locale resolved from `user.language` / cookie / fallback, so
 * the very first SSR render and the first client render produce the
 * same strings — no hydration flash.
 *
 * `setLocale(next)` writes a `locale` cookie so the server picks up the
 * change on the next request, and triggers a re-render in-page so the UI
 * updates immediately. We deliberately do NOT trigger a full reload — the
 * user's stored preference is updated separately via the profile form.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { t as rawT, getTranslations } from './translate';
import { getLocale } from './registry';
import type { Translation } from './types';

interface LocaleContextValue {
    locale: string;
    direction: 'ltr' | 'rtl';
    t: (key: string, params?: Record<string, string | number>) => string;
    setLocale: (next: string) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
    /** Initial locale, supplied by the server (typically `user.language`). */
    initialLocale: string;
    /**
     * Optional preloaded dictionary for the initial locale. Avoids a
     * bundle-time tree-walk on first paint when the caller already has
     * one in hand (e.g. for a tenant-supplied override).
     */
    initialDictionary?: Translation;
    children: React.ReactNode;
}

export function LocaleProvider({ initialLocale, initialDictionary, children }: LocaleProviderProps) {
    const [locale, setLocaleState] = useState<string>(initialLocale || 'en');

    // Register the supplied dictionary on first mount so callers can ship
    // tenant-specific overrides without editing the bundled JSON.
    React.useEffect(() => {
        if (!initialDictionary) return;
        // Lazy import keeps the registry off the critical path.
        void import('./translate').then(({ registerTranslations }) => {
            registerTranslations(initialLocale, initialDictionary);
        });
    }, [initialLocale, initialDictionary]);

    const setLocale = useCallback((next: string) => {
        setLocaleState(next);
        // Persist for the server. Path=/ so RSCs under any route see it.
        // 1 year keeps it stable across sessions; the user can clear it
        // by re-saving their profile language preference.
        if (typeof document !== 'undefined') {
            document.cookie = `locale=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        }
    }, []);

    const t = useCallback(
        (key: string, params: Record<string, string | number> = {}) => rawT(key, params, locale),
        [locale],
    );

    const direction = useMemo<'ltr' | 'rtl'>(() => getLocale(locale).direction, [locale]);

    const value = useMemo<LocaleContextValue>(
        () => ({ locale, direction, t, setLocale }),
        [locale, direction, t, setLocale],
    );

    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Primary translation hook for client components.
 *
 *   const { t, locale } = useT();
 *   return <h1>{t('sabflow.connections.title')}</h1>;
 *
 * If the provider is missing (e.g. a component rendered outside the
 * dashboard tree), falls back to English so the UI still renders.
 */
export function useT(): LocaleContextValue {
    const ctx = useContext(LocaleContext);
    if (ctx) return ctx;
    // Provider-less fallback. We don't throw because some marketing /
    // auth pages render dashboard components without the provider.
    return {
        locale: 'en',
        direction: 'ltr',
        t: (key, params = {}) => rawT(key, params, 'en'),
        setLocale: () => {
            /* no-op */
        },
    };
}

/**
 * Read-only locale accessor for components that don't translate but need
 * the locale for `Intl.*` formatters.
 */
export function useLocale(): string {
    return useT().locale;
}

/**
 * Returns the merged dictionary for the active locale. Use sparingly —
 * `useT().t(key)` is the right primitive for normal call sites.
 */
export function useTranslations(): Translation {
    const { locale } = useT();
    return useMemo(() => getTranslations(locale), [locale]);
}
