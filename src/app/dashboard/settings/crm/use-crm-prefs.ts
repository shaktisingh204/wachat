'use client';

/**
 * SabCRM — local UI preferences hook.
 *
 * A tiny, self-contained `localStorage`-backed store for the handful of
 * client-only display preferences surfaced in Settings → Profile / Appearance.
 * There is no backend for these yet, so they live purely on the device:
 *
 *   - `displayName` / `email` — local overrides shown in the Profile form. They
 *     seed from the session user and persist edits without a server round-trip.
 *   - `theme`    — 'light' | 'dark' | 'system'. Toggles `st-theme-dark` on the
 *                  SabCRM frame root (`.sabcrm-twenty`) so the whole module
 *                  re-themes via CSS. 'system' follows `prefers-color-scheme`
 *                  and live-updates when the OS preference flips.
 *   - `density`  — 'comfortable' | 'compact'. Applied by toggling a class on
 *                  the SabCRM frame root (`.sabcrm-twenty`) so the table / row
 *                  rhythm can tighten without touching server state.
 *   - `language` — display-only BCP-47-ish tag (English only for now).
 *
 * Everything fails closed: SSR / private-mode / quota errors fall back to the
 * defaults and never throw, so a page that mounts this hook can always render.
 */

import * as React from 'react';

export type CrmTheme = 'light' | 'dark' | 'system';
export type CrmDensity = 'comfortable' | 'compact';

export interface CrmPrefs {
  displayName: string;
  email: string;
  theme: CrmTheme;
  density: CrmDensity;
  language: string;
}

const STORAGE_KEY = 'sabcrm.prefs.v1';

const DEFAULT_PREFS: CrmPrefs = {
  displayName: '',
  email: '',
  theme: 'light',
  density: 'comfortable',
  language: 'en',
};

function readStored(): Partial<CrmPrefs> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as Partial<CrmPrefs>;
    return {};
  } catch {
    return {};
  }
}

function writeStored(prefs: CrmPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / private mode — preferences stay in-memory only */
  }
}

export interface UseCrmPrefsResult {
  prefs: CrmPrefs;
  /** Merge a partial update into the stored prefs. */
  setPrefs: (patch: Partial<CrmPrefs>) => void;
  /** Restore every preference to its default. */
  reset: () => void;
  /** True once the client has hydrated from localStorage (avoids SSR flash). */
  hydrated: boolean;
}

/**
 * Reactive accessor for the SabCRM local preferences. Reads once on mount,
 * persists every change, and reflects the active density onto the frame root.
 */
export function useCrmPrefs(): UseCrmPrefsResult {
  const [prefs, setPrefsState] = React.useState<CrmPrefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydrate from storage after mount so SSR and first client render agree.
  React.useEffect(() => {
    setPrefsState({ ...DEFAULT_PREFS, ...readStored() });
    setHydrated(true);
  }, []);

  // Reflect the chosen density onto the SabCRM frame root so the whole module
  // can respond via CSS. Cleaned up if the consuming page unmounts.
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.querySelector('.sabcrm-twenty');
    if (!root) return;
    root.classList.toggle('st-density-compact', prefs.density === 'compact');
  }, [prefs.density]);

  // Reflect the chosen theme onto the SabCRM frame root. 'dark' forces the dark
  // palette; 'system' follows `prefers-color-scheme` and live-updates when the
  // OS preference flips; 'light' (or no match) removes the override class.
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.querySelector('.sabcrm-twenty');
    if (!root) return;

    const apply = (isDark: boolean) => {
      root.classList.toggle('st-theme-dark', isDark);
    };

    if (prefs.theme === 'system' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches);
      const onChange = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    apply(prefs.theme === 'dark');
    return undefined;
  }, [prefs.theme]);

  const setPrefs = React.useCallback((patch: Partial<CrmPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      writeStored(next);
      return next;
    });
  }, []);

  const reset = React.useCallback(() => {
    setPrefsState(() => {
      writeStored(DEFAULT_PREFS);
      return DEFAULT_PREFS;
    });
  }, []);

  return { prefs, setPrefs, reset, hydrated };
}
