'use client';

/**
 * SabCRM — shared settings ⇄ server sync helper.
 *
 * The per-page preference hooks (`useCrmPrefs`, `useNotifPrefs`, `useL10nPrefs`)
 * keep an instant, device-scoped `localStorage` cache so the UI never blocks and
 * always has *something* to render. For real Twenty parity those preferences
 * must also persist on the backend so they follow the user across devices.
 *
 * The CRM exposes a free-form per-project settings document via the gated
 * `getCrmSettingsTw` / `updateCrmSettingsTw` server actions (see
 * `@/app/actions/sabcrm-settings.actions`). This hook namespaces a slice of that
 * document under a single key (e.g. `'profile'`, `'appearance'`, `'notifications'`,
 * `'localization'`) and gives a page:
 *
 *   1. a one-shot **load** on mount that, when the server slice exists, hands it
 *      back so the page can adopt it (server is the source of truth) — falling
 *      back silently to the local cache when the engine is down / unauthorized;
 *   2. a **save** that merge-writes the slice back under its key and reports a
 *      `'saved' | 'offline' | 'error'` outcome the page can surface inline.
 *
 * Everything fails closed: an unreachable Rust engine, RBAC denial or plan gate
 * never throws — the page keeps working off its local cache and simply shows an
 * "offline" status instead of "saved". This mirrors how `general/page.tsx`
 * already degrades.
 */

import * as React from 'react';

import {
  getCrmSettingsTw,
  updateCrmSettingsTw,
} from '@/app/actions/sabcrm-settings.actions';

/** Outcome of a server persistence attempt. */
export type SyncOutcome = 'saved' | 'offline' | 'error';

/** Phase of the initial server load. */
export type SyncPhase = 'loading' | 'ready' | 'offline';

export interface UseSettingsSyncResult<T> {
  /** Phase of the initial server load. */
  phase: SyncPhase;
  /**
   * The server-stored slice resolved on mount, or `null` when there was none
   * (or the engine was unreachable). A page adopts this over its local cache.
   */
  remote: T | null;
  /** Merge-persist a slice back to the server under this hook's key. */
  save: (slice: T) => Promise<SyncOutcome>;
  /** True once the initial server load has settled (success or offline). */
  loaded: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Syncs a single namespaced slice of the CRM settings document.
 *
 * @param key      The settings-document key this slice lives under.
 * @param coerce   Narrows the raw stored value into the page's typed slice.
 *                 Return `null` when the stored value is absent / unusable so
 *                 the page keeps its local default.
 */
export function useSettingsSync<T>(
  key: string,
  coerce: (raw: unknown) => T | null,
): UseSettingsSyncResult<T> {
  const [phase, setPhase] = React.useState<SyncPhase>('loading');
  const [remote, setRemote] = React.useState<T | null>(null);

  // Keep the latest coerce without re-running the load effect on each render.
  const coerceRef = React.useRef(coerce);
  coerceRef.current = coerce;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getCrmSettingsTw();
        if (cancelled) return;
        if (res.ok && isRecord(res.data)) {
          const slice = coerceRef.current(res.data[key]);
          setRemote(slice);
          setPhase('ready');
        } else {
          // RBAC / plan / engine-down: fall back to the local cache silently.
          setPhase('offline');
        }
      } catch {
        if (!cancelled) setPhase('offline');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  const save = React.useCallback(
    async (slice: T): Promise<SyncOutcome> => {
      try {
        const res = await updateCrmSettingsTw({ [key]: slice });
        return res.ok ? 'saved' : 'offline';
      } catch {
        return 'error';
      }
    },
    [key],
  );

  return { phase, remote, save, loaded: phase !== 'loading' };
}
