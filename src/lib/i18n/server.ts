/**
 * Server-side i18n bridge.
 *
 * Two things this module is responsible for:
 *
 *   1. `getCurrentLocale()` — resolve the active locale for the current
 *      request. Order of precedence:
 *        a. `?locale=` query param (handy for previews / QA)
 *        b. `locale` cookie (set by the client provider after the user
 *           switches language without a full reload)
 *        c. `user.language` on the persisted session
 *        d. `'en'` fallback
 *
 *   2. `getT(locale?)` — a server-equivalent of the client `useT()` hook.
 *      Returns a `t(key, params?)` function bound to the resolved locale,
 *      usable inside React Server Components, Server Actions, Route
 *      Handlers, and `generateMetadata`.
 *
 * Both helpers stay synchronous after the initial locale resolution —
 * `getT()` returns a plain function so callers can sprinkle `t(...)` calls
 * without `await` noise.
 *
 * Pairs with `src/lib/i18n/client.tsx` for the client-side equivalent.
 */
import 'server-only';

import { cookies, headers } from 'next/headers';

import { getSession } from '@/app/actions/user.actions';
import { t as rawT, getTranslations } from './translate';
import type { Translation } from './types';

const LOCALE_COOKIE = 'locale';
const FALLBACK_LOCALE = 'en';

/**
 * Resolve the active locale for the current server request.
 *
 * Safe to call from RSCs, Server Actions, and Route Handlers — it only
 * touches `cookies()` / `headers()` / the session, never the DOM.
 */
export async function getCurrentLocale(): Promise<string> {
    // 1. Query string override (e.g. `?locale=hi`). Useful when a tenant
    //    admin wants to preview translations without flipping their own
    //    saved preference.
    try {
        const hdrs = await headers();
        const url = hdrs.get('x-url') ?? hdrs.get('referer');
        if (url) {
            try {
                const parsed = new URL(url, 'http://localhost');
                const q = parsed.searchParams.get('locale');
                if (q) return q;
            } catch {
                /* not a valid URL — fall through */
            }
        }
    } catch {
        /* headers() failed (e.g. outside request scope) — fall through */
    }

    // 2. Cookie set by the client provider on language switch.
    try {
        const store = await cookies();
        const fromCookie = store.get(LOCALE_COOKIE)?.value;
        if (fromCookie) return fromCookie;
    } catch {
        /* cookies() unavailable — fall through */
    }

    // 3. The user's saved preference on their profile.
    try {
        const session = await getSession();
        const fromUser = (session?.user as { language?: string } | null | undefined)?.language;
        if (fromUser) return fromUser;
    } catch {
        /* session lookup failed — fall back to English */
    }

    return FALLBACK_LOCALE;
}

/**
 * Synchronous server-side translator factory.
 *
 * Usage from a Server Component:
 *
 *   const t = await getT();
 *   return <h1>{t('sabflow.connections.title')}</h1>;
 *
 * Pass an explicit locale when rendering for a different audience (e.g. a
 * webhook payload to an external customer).
 */
export async function getT(locale?: string): Promise<(key: string, params?: Record<string, string | number>) => string> {
    const resolved = locale ?? (await getCurrentLocale());
    return (key, params = {}) => rawT(key, params, resolved);
}

/**
 * Returns the full translation dictionary for a locale. Useful when you
 * need to ship a JSON bundle to the client (e.g. as a serialized prop on
 * a Server Component → Client Component boundary).
 */
export function getServerTranslations(locale: string): Translation {
    return getTranslations(locale);
}
