'use client';

/**
 * SabCRM workspace-settings context.
 *
 * The CRM settings pages (`/dashboard/settings/crm/*`) persist their values
 * server-side (the per-project settings document, `data.<section>`), but a
 * stored value only *reflects* in the app when something reads and applies it.
 * This context is that bridge: {@link TwentyAppFrame} loads the settings
 * document once and provides the resolved values + ready-made Intl formatters
 * to every `/sabcrm/*` surface via {@link useSabcrmSettings}.
 *
 * Sections surfaced here (all optional / partial — missing → sensible default):
 *  - `general`       — workspace identity (name, icon) + defaults
 *  - `appearance`    — theme + density (applied to the frame root)
 *  - `localization`  — language / formats → {@link SabcrmFormatters}
 *  - `notifications` — `{ muteAll, events }` (read by the notifications bell)
 *  - `lab`           — experimental feature flags (read by gated features)
 *
 * Everything fails closed: until the load resolves (or if it fails) the
 * context exposes {@link DEFAULT_SABCRM_SETTINGS} so consumers always render.
 */

import * as React from 'react';

// ---------------------------------------------------------------------------
// Section shapes (loose, partial — mirror the typed Rust sections)
// ---------------------------------------------------------------------------

export interface SabcrmGeneralPrefs {
  workspaceName?: string;
  iconEmoji?: string;
  defaultObject?: string;
  defaultCurrency?: string;
  dateFormat?: string;
  timeZone?: string;
}

export type SabcrmTheme = 'light' | 'dark' | 'system';
export type SabcrmDensity = 'comfortable' | 'compact';

export interface SabcrmAppearancePrefs {
  theme?: SabcrmTheme;
  density?: SabcrmDensity;
  language?: string;
}

export interface SabcrmLocalizationPrefs {
  language?: string;
  dateFormat?: string;
  timeFormat?: '12h' | '24h';
  numberFormat?: string;
  currency?: string;
  timeZone?: string;
  firstDayOfWeek?: number;
}

export interface SabcrmNotificationPrefs {
  muteAll?: boolean;
  events?: Record<string, { inApp?: boolean; email?: boolean }>;
}

export type SabcrmLabFlags = Record<string, boolean>;

/** Locale-aware formatters derived from the localization section. */
export interface SabcrmFormatters {
  /** Date only (honours dateFormat preset + timeZone). */
  date: (value: unknown) => string;
  /** Time only (honours 12h/24h + timeZone). */
  time: (value: unknown) => string;
  /** Date + time. */
  dateTime: (value: unknown) => string;
  /** Grouped number (honours numberFormat locale). */
  number: (value: unknown) => string;
  /** Currency (honours currency code + numberFormat locale). */
  currency: (value: unknown, currencyOverride?: string) => string;
}

export interface SabcrmSettingsValue {
  /** True once the initial server load has settled (success or failure). */
  loaded: boolean;
  general: SabcrmGeneralPrefs;
  appearance: SabcrmAppearancePrefs;
  localization: SabcrmLocalizationPrefs;
  notifications: SabcrmNotificationPrefs;
  lab: SabcrmLabFlags;
  /** `system` + the lab dark-mode flag resolved to a concrete theme. */
  resolvedTheme: 'light' | 'dark';
  /** Effective density (defaults to `comfortable`). */
  density: SabcrmDensity;
  /** Locale-aware formatters built from {@link SabcrmLocalizationPrefs}. */
  fmt: SabcrmFormatters;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Map a stored date-format preset to an Intl `dateStyle`. */
function dateStyleOf(
  preset: string | undefined,
): 'short' | 'medium' | 'long' | 'full' {
  switch (preset) {
    case 'short':
      return 'short';
    case 'long':
      return 'long';
    case 'full':
      return 'full';
    default:
      return 'medium';
  }
}

/**
 * Build locale-aware formatters from the localization section. Every formatter
 * is defensive: invalid input or an unsupported locale falls back to a plain
 * string so a misconfigured pref can never crash a record view.
 */
export function buildSabcrmFormatters(
  l10n: SabcrmLocalizationPrefs,
): SabcrmFormatters {
  const locale = l10n.language || 'en-US';
  const numLocale = l10n.numberFormat || locale;
  const timeZone = l10n.timeZone || undefined;
  const hour12 = l10n.timeFormat ? l10n.timeFormat === '12h' : undefined;
  const dateStyle = dateStyleOf(l10n.dateFormat);
  const currencyCode = l10n.currency || 'USD';

  const dateOnly = (value: unknown): string => {
    const d = toDate(value);
    if (!d) return value == null ? '' : String(value);
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle, timeZone }).format(d);
    } catch {
      return d.toLocaleDateString();
    }
  };
  const timeOnly = (value: unknown): string => {
    const d = toDate(value);
    if (!d) return value == null ? '' : String(value);
    try {
      return new Intl.DateTimeFormat(locale, {
        timeStyle: 'short',
        hour12,
        timeZone,
      }).format(d);
    } catch {
      return d.toLocaleTimeString();
    }
  };
  const dateTime = (value: unknown): string => {
    const d = toDate(value);
    if (!d) return value == null ? '' : String(value);
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle,
        timeStyle: 'short',
        hour12,
        timeZone,
      }).format(d);
    } catch {
      return d.toLocaleString();
    }
  };
  const number = (value: unknown): string => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return value == null ? '' : String(value);
    try {
      return new Intl.NumberFormat(numLocale).format(n);
    } catch {
      return String(n);
    }
  };
  const currency = (value: unknown, currencyOverride?: string): string => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return value == null ? '' : String(value);
    try {
      return new Intl.NumberFormat(numLocale, {
        style: 'currency',
        currency: currencyOverride || currencyCode,
      }).format(n);
    } catch {
      return String(n);
    }
  };

  return { date: dateOnly, time: timeOnly, dateTime, number, currency };
}

/** Resolve `light | dark | system` (+ the lab dark-mode flag) to a concrete theme. */
export function resolveSabcrmTheme(
  theme: SabcrmTheme | undefined,
  labDarkMode: boolean | undefined,
  systemPrefersDark: boolean,
): 'light' | 'dark' {
  if (labDarkMode) return 'dark';
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  // 'system' (or unset) → follow the OS preference.
  return systemPrefersDark ? 'dark' : 'light';
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const DEFAULT_SABCRM_SETTINGS: SabcrmSettingsValue = {
  loaded: false,
  general: {},
  appearance: {},
  localization: {},
  notifications: {},
  lab: {},
  resolvedTheme: 'light',
  density: 'comfortable',
  fmt: buildSabcrmFormatters({}),
};

const SabcrmSettingsContext = React.createContext<SabcrmSettingsValue>(
  DEFAULT_SABCRM_SETTINGS,
);

/**
 * Read the resolved SabCRM workspace settings. Safe to call from any
 * `/sabcrm/*` surface — outside the provider it returns
 * {@link DEFAULT_SABCRM_SETTINGS} (light theme, comfortable density, en-US
 * formatters, no lab flags), so consumers never need a null check.
 */
export function useSabcrmSettings(): SabcrmSettingsValue {
  return React.useContext(SabcrmSettingsContext);
}

export const SabcrmSettingsProvider = SabcrmSettingsContext.Provider;
