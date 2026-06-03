'use client';

/**
 * SabCRM — local Localization preferences hook.
 *
 * A tiny, self-contained `localStorage`-backed store for the regional /
 * formatting preferences surfaced in Settings → Localization. There is no
 * backend for these yet, so they live purely on the device. The values are
 * deliberately framed as inputs to the browser's `Intl` APIs so every choice
 * has an immediate, real-world preview:
 *
 *   - `language`       — BCP-47 locale tag used as the base for every `Intl`
 *                        formatter preview (and, eventually, the UI language).
 *   - `dateFormat`     — symbolic preset mapped to `Intl.DateTimeFormat` opts.
 *   - `timeFormat`     — '12h' | '24h'; toggles `hour12` on time previews.
 *   - `numberFormat`   — decimal/grouping convention expressed as a formatting
 *                        locale (e.g. 'en-US' → 1,234.56, 'de-DE' → 1.234,56).
 *   - `currency`       — ISO-4217 code fed to `Intl.NumberFormat`.
 *   - `timeZone`       — IANA zone used for date/time previews.
 *   - `firstDayOfWeek` — 0 (Sunday) … 6 (Saturday); display-only calendar hint.
 *
 * Everything fails closed: SSR / private-mode / quota errors fall back to the
 * defaults and never throw, so a page that mounts this hook can always render.
 */

import * as React from 'react';

export type L10nTimeFormat = '12h' | '24h';

/** 0 = Sunday … 6 = Saturday (matches JS `Date.getDay()`). */
export type L10nFirstDayOfWeek = 0 | 1 | 6;

export interface L10nPrefs {
  /** BCP-47 base locale tag, e.g. 'en-US'. */
  language: string;
  /** Date-format preset key (see `DATE_FORMAT_PRESETS`). */
  dateFormat: string;
  /** 12- or 24-hour clock. */
  timeFormat: L10nTimeFormat;
  /** Locale used purely to drive number grouping / decimal separator. */
  numberFormat: string;
  /** ISO-4217 currency code, e.g. 'USD'. */
  currency: string;
  /** IANA time zone, e.g. 'America/New_York', or '' for system default. */
  timeZone: string;
  /** First day shown in calendars. */
  firstDayOfWeek: L10nFirstDayOfWeek;
}

const STORAGE_KEY = 'sabcrm.l10n.v1';

const DEFAULT_PREFS: L10nPrefs = {
  language: 'en-US',
  dateFormat: 'medium',
  timeFormat: '12h',
  numberFormat: 'en-US',
  currency: 'USD',
  timeZone: '',
  firstDayOfWeek: 0,
};

function isFirstDay(value: unknown): value is L10nFirstDayOfWeek {
  return value === 0 || value === 1 || value === 6;
}

function isTimeFormat(value: unknown): value is L10nTimeFormat {
  return value === '12h' || value === '24h';
}

/** Read + sanitize stored prefs. Unknown / corrupt shapes collapse to {}. */
function readStored(): Partial<L10nPrefs> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const obj = parsed as Record<string, unknown>;
    const out: Partial<L10nPrefs> = {};
    if (typeof obj.language === 'string') out.language = obj.language;
    if (typeof obj.dateFormat === 'string') out.dateFormat = obj.dateFormat;
    if (isTimeFormat(obj.timeFormat)) out.timeFormat = obj.timeFormat;
    if (typeof obj.numberFormat === 'string') out.numberFormat = obj.numberFormat;
    if (typeof obj.currency === 'string') out.currency = obj.currency;
    if (typeof obj.timeZone === 'string') out.timeZone = obj.timeZone;
    if (isFirstDay(obj.firstDayOfWeek)) out.firstDayOfWeek = obj.firstDayOfWeek;
    return out;
  } catch {
    return {};
  }
}

function writeStored(prefs: L10nPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / private mode — preferences stay in-memory only */
  }
}

export interface UseL10nPrefsResult {
  prefs: L10nPrefs;
  /** Merge a partial update into the stored prefs. */
  setPrefs: (patch: Partial<L10nPrefs>) => void;
  /** Restore every preference to its default. */
  reset: () => void;
  /** True once the client has hydrated from localStorage (avoids SSR flash). */
  hydrated: boolean;
}

/**
 * Reactive accessor for the SabCRM localization preferences. Reads once on
 * mount and persists every change. Purely client-side; nothing is reflected
 * onto the DOM (these only drive `Intl` previews for now).
 */
export function useL10nPrefs(): UseL10nPrefsResult {
  const [prefs, setPrefsState] = React.useState<L10nPrefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydrate from storage after mount so SSR and first client render agree.
  React.useEffect(() => {
    setPrefsState({ ...DEFAULT_PREFS, ...readStored() });
    setHydrated(true);
  }, []);

  const setPrefs = React.useCallback((patch: Partial<L10nPrefs>) => {
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
