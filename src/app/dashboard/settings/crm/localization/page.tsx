'use client';

/**
 * SabCRM — Localization settings (`/dashboard/settings/crm/localization`),
 * Twenty-style.
 *
 * Device-scoped regional + formatting controls. Every option drives a live
 * preview built from the browser's `Intl` APIs, so users see exactly how
 * dates, times, numbers and currencies will render under their choice:
 *
 *   - Language        — base BCP-47 locale for every preview.
 *   - Date format     — preset mapped to `Intl.DateTimeFormat` options.
 *   - Time format     — 12h / 24h (toggles `hour12`).
 *   - Number format   — decimal / grouping separator convention.
 *   - Default currency — ISO-4217 code, previewed via `Intl.NumberFormat`.
 *   - Timezone        — IANA zone (uses `Intl.supportedValuesOf` when present,
 *                       else a curated subset), previewed against "now".
 *   - First day of week — Sunday / Monday / Saturday.
 *
 * Choices persist to BOTH the gated CRM settings document on the backend (via
 * `useSettingsSync('localization', …)` → the `getCrmSettingsTw` /
 * `updateCrmSettingsTw` server actions) AND the local `useL10nPrefs` cache, so a
 * user's regional setup follows them across devices while the page never blocks.
 * When the Rust settings engine is down the page degrades to the device-local
 * cache and shows an "offline" note. The page renders a skeleton until hydrated,
 * and every `Intl` call is guarded so an unsupported locale / zone degrades to a
 * readable fallback rather than throwing.
 */

import * as React from 'react';
import { Languages } from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useToast } from '@/hooks/use-toast';
import {
  useL10nPrefs,
  type L10nPrefs,
  type L10nTimeFormat,
  type L10nFirstDayOfWeek,
} from './use-l10n-prefs';
import { useSettingsSync } from '../use-settings-sync';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../settings-twenty.css';
import '../profile/profile.css';
import './localization.css';

/**
 * Narrow the raw stored value into a usable localization slice. Only requires an
 * object — `useL10nPrefs.setPrefs` merges field-by-field and the hook's own
 * sanitizing read coerces individual fields, so partial payloads are safe.
 */
function coerceL10n(raw: unknown): Partial<L10nPrefs> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Partial<L10nPrefs>;
}

/* -------------------------------------------------------------------------
   Static option tables
   ---------------------------------------------------------------------- */

interface Option {
  value: string;
  label: string;
}

const LANGUAGE_OPTIONS: Option[] = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'hi-IN', label: 'Hindi (India)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
];

/** Each date-format preset maps to a concrete `Intl.DateTimeFormat` config. */
const DATE_FORMAT_PRESETS: Array<{
  value: string;
  label: string;
  options: Intl.DateTimeFormatOptions;
}> = [
  {
    value: 'short',
    label: 'Short — e.g. 6/3/26',
    options: { year: '2-digit', month: 'numeric', day: 'numeric' },
  },
  {
    value: 'medium',
    label: 'Medium — e.g. Jun 3, 2026',
    options: { year: 'numeric', month: 'short', day: 'numeric' },
  },
  {
    value: 'long',
    label: 'Long — e.g. June 3, 2026',
    options: { year: 'numeric', month: 'long', day: 'numeric' },
  },
  {
    value: 'full',
    label: 'Full — e.g. Wednesday, June 3, 2026',
    options: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  },
  {
    value: 'numeric',
    label: 'Numeric — e.g. 2026-06-03',
    options: { year: 'numeric', month: '2-digit', day: '2-digit' },
  },
];

const TIME_FORMAT_OPTIONS: Array<{ value: L10nTimeFormat; label: string }> = [
  { value: '12h', label: '12-hour — e.g. 2:30 PM' },
  { value: '24h', label: '24-hour — e.g. 14:30' },
];

/**
 * The "number format" choice is expressed as the formatting locale that yields
 * the desired grouping / decimal separators. Kept separate from `language` so a
 * user can keep an English UI while preferring European number conventions.
 */
const NUMBER_FORMAT_OPTIONS: Option[] = [
  { value: 'en-US', label: '1,234,567.89  (comma group, dot decimal)' },
  { value: 'de-DE', label: '1.234.567,89  (dot group, comma decimal)' },
  { value: 'fr-FR', label: '1 234 567,89  (space group, comma decimal)' },
  { value: 'en-IN', label: '12,34,567.89  (Indian grouping)' },
  { value: 'de-CH', label: "1'234'567.89  (apostrophe group, dot decimal)" },
];

const CURRENCY_OPTIONS: Option[] = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'CNY', label: 'CNY — Chinese Yuan' },
  { value: 'BRL', label: 'BRL — Brazilian Real' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'CHF', label: 'CHF — Swiss Franc' },
];

const FIRST_DAY_OPTIONS: Array<{ value: L10nFirstDayOfWeek; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 6, label: 'Saturday' },
];

/** Curated fallback when `Intl.supportedValuesOf('timeZone')` is unavailable. */
const FALLBACK_TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

/* -------------------------------------------------------------------------
   Intl helpers — every call is guarded so a bad locale / zone never throws
   ---------------------------------------------------------------------- */

const SAMPLE_DATE = new Date('2026-06-03T14:30:00');
const SAMPLE_AMOUNT = 1234567.89;

function dateOptionsFor(key: string): Intl.DateTimeFormatOptions {
  return (
    DATE_FORMAT_PRESETS.find((p) => p.value === key)?.options ??
    DATE_FORMAT_PRESETS[1].options
  );
}

function safeFormat(fn: () => string): { value: string; ok: boolean } {
  try {
    return { value: fn(), ok: true };
  } catch {
    return { value: 'Not available in this browser', ok: false };
  }
}

function previewDate(prefs: L10nPrefs): { value: string; ok: boolean } {
  return safeFormat(() => {
    const opts: Intl.DateTimeFormatOptions = { ...dateOptionsFor(prefs.dateFormat) };
    if (prefs.timeZone) opts.timeZone = prefs.timeZone;
    return new Intl.DateTimeFormat(prefs.language, opts).format(SAMPLE_DATE);
  });
}

function previewTime(prefs: L10nPrefs): { value: string; ok: boolean } {
  return safeFormat(() => {
    const opts: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: prefs.timeFormat === '12h',
    };
    if (prefs.timeZone) opts.timeZone = prefs.timeZone;
    return new Intl.DateTimeFormat(prefs.language, opts).format(SAMPLE_DATE);
  });
}

function previewNumber(prefs: L10nPrefs): { value: string; ok: boolean } {
  return safeFormat(() =>
    new Intl.NumberFormat(prefs.numberFormat).format(SAMPLE_AMOUNT),
  );
}

function previewCurrency(prefs: L10nPrefs): { value: string; ok: boolean } {
  return safeFormat(() =>
    new Intl.NumberFormat(prefs.numberFormat, {
      style: 'currency',
      currency: prefs.currency,
    }).format(SAMPLE_AMOUNT),
  );
}

function previewTimeZone(prefs: L10nPrefs): { value: string; ok: boolean } {
  return safeFormat(() => {
    const opts: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: prefs.timeFormat === '12h',
      timeZoneName: 'short',
    };
    if (prefs.timeZone) opts.timeZone = prefs.timeZone;
    return new Intl.DateTimeFormat(prefs.language, opts).format(new Date());
  });
}

function previewFirstDay(prefs: L10nPrefs): { value: string; ok: boolean } {
  return safeFormat(() => {
    // Build the week header order starting from the chosen first day.
    const fmt = new Intl.DateTimeFormat(prefs.language, { weekday: 'short' });
    // 2024-01-07 is a Sunday → index 0 lines up with getDay().
    const days = Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2024, 0, 7 + ((prefs.firstDayOfWeek + i) % 7))),
    );
    return days.join('  ');
  });
}

/* -------------------------------------------------------------------------
   Small presentational pieces
   ---------------------------------------------------------------------- */

function Preview({
  label,
  result,
}: {
  label: string;
  result: { value: string; ok: boolean };
}): React.JSX.Element {
  return (
    <div
      className={`st-l10n-preview${result.ok ? '' : ' st-l10n-preview--muted'}`}
      aria-live="polite"
    >
      <span className="st-l10n-preview__label">{label}</span>
      <span className="st-l10n-preview__value">{result.value}</span>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  options,
  onChange,
  preview,
  help,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (next: string) => void;
  preview: { value: string; ok: boolean };
  help?: string;
}): React.JSX.Element {
  return (
    <div className="st-field st-l10n-field">
      <label className="st-field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="st-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {help ? <span className="st-field__help">{help}</span> : null}
      <Preview label="Preview" result={preview} />
    </div>
  );
}

/* -------------------------------------------------------------------------
   Page
   ---------------------------------------------------------------------- */

export default function SabcrmLocalizationSettingsPage(): React.JSX.Element {
  const { prefs, setPrefs, reset, hydrated } = useL10nPrefs();
  const { toast } = useToast();
  const sync = useSettingsSync<Partial<L10nPrefs>>('localization', coerceL10n);

  // Adopt the server slice (source of truth) once it resolves, merging it into
  // the local cache (the hook re-sanitizes each field).
  React.useEffect(() => {
    if (sync.phase !== 'ready' || !sync.remote) return;
    setPrefs(sync.remote);
  }, [sync.phase, sync.remote, setPrefs]);

  // Resolve the timezone list once: prefer the full IANA set when the runtime
  // exposes `Intl.supportedValuesOf`, otherwise fall back to a curated subset.
  const timeZones = React.useMemo<string[]>(() => {
    try {
      const supported = (
        Intl as unknown as {
          supportedValuesOf?: (key: string) => string[];
        }
      ).supportedValuesOf;
      if (typeof supported === 'function') {
        const zones = supported('timeZone');
        if (Array.isArray(zones) && zones.length > 0) return zones;
      }
    } catch {
      /* fall through to the curated list */
    }
    return FALLBACK_TIMEZONES;
  }, []);

  const timeZoneOptions = React.useMemo<Option[]>(
    () => [
      { value: '', label: 'System default' },
      ...timeZones.map((z) => ({ value: z, label: z.replace(/_/g, ' ') })),
    ],
    [timeZones],
  );

  const patch = React.useCallback(
    (next: Partial<L10nPrefs>) => {
      setPrefs(next);
      // Persist the fully-resolved slice to the server (fire-and-forget; local
      // cache already updated synchronously, so the UI is never blocked).
      void sync.save({ ...prefs, ...next });
    },
    [setPrefs, sync, prefs],
  );

  const handleReset = React.useCallback(() => {
    reset();
    // Clear the server slice too so the reset sticks across devices; an empty
    // object is normalized back to defaults on read.
    void sync.save({});
    toast({
      title: 'Localization reset',
      description: 'Regional and formatting preferences restored to defaults.',
    });
  }, [reset, sync, toast]);

  // Derive every preview from the current prefs (cheap; recomputed per render).
  const datePreview = previewDate(prefs);
  const timePreview = previewTime(prefs);
  const numberPreview = previewNumber(prefs);
  const currencyPreview = previewCurrency(prefs);
  const timeZonePreview = previewTimeZone(prefs);
  const firstDayPreview = previewFirstDay(prefs);

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Localization" icon={Languages} />
        <p className="st-settings__intro">
          Choose how dates, times, numbers and currencies are displayed in
          SabCRM. Each preview updates live. Saved to your workspace so your
          regional setup follows you across devices.
          {sync.phase === 'offline' ? (
            <span className="st-form-status st-form-status--err" style={{ display: 'block', marginTop: 4 }}>
              The settings service is offline — changes are kept on this device
              for now.
            </span>
          ) : null}
        </p>

        {!hydrated ? (
          <div className="st-section" aria-busy="true" aria-live="polite">
            <div className="st-l10n-skeleton" />
            <span className="st-field__help">Loading your preferences…</span>
          </div>
        ) : (
          <>
            <div className="st-section">
              <div className="st-section__head">
                <h2 className="st-section__title">Language</h2>
                <p className="st-section__hint">
                  The base locale used to format dates, times and names.
                </p>
              </div>
              <Field
                id="l10n-language"
                label="Display language"
                value={prefs.language}
                options={LANGUAGE_OPTIONS}
                onChange={(language) => patch({ language })}
                preview={datePreview}
                help="More UI translations are coming soon; formatting applies now."
              />
            </div>

            <div className="st-section">
              <div className="st-section__head">
                <h2 className="st-section__title">Date format</h2>
                <p className="st-section__hint">
                  How calendar dates are written throughout SabCRM.
                </p>
              </div>
              <Field
                id="l10n-date-format"
                label="Date format"
                value={prefs.dateFormat}
                options={DATE_FORMAT_PRESETS.map((p) => ({
                  value: p.value,
                  label: p.label,
                }))}
                onChange={(dateFormat) => patch({ dateFormat })}
                preview={datePreview}
              />
            </div>

            <div className="st-section">
              <div className="st-section__head">
                <h2 className="st-section__title">Time format</h2>
                <p className="st-section__hint">
                  Use a 12-hour clock with AM/PM, or a 24-hour clock.
                </p>
              </div>
              <Field
                id="l10n-time-format"
                label="Time format"
                value={prefs.timeFormat}
                options={TIME_FORMAT_OPTIONS}
                onChange={(value) =>
                  patch({ timeFormat: value as L10nTimeFormat })
                }
                preview={timePreview}
              />
            </div>

            <div className="st-section">
              <div className="st-section__head">
                <h2 className="st-section__title">Number format</h2>
                <p className="st-section__hint">
                  Controls the grouping and decimal separators for numbers.
                </p>
              </div>
              <Field
                id="l10n-number-format"
                label="Decimal & grouping separators"
                value={prefs.numberFormat}
                options={NUMBER_FORMAT_OPTIONS}
                onChange={(numberFormat) => patch({ numberFormat })}
                preview={numberPreview}
              />
            </div>

            <div className="st-section">
              <div className="st-section__head">
                <h2 className="st-section__title">Default currency</h2>
                <p className="st-section__hint">
                  The currency used when displaying monetary amounts.
                </p>
              </div>
              <Field
                id="l10n-currency"
                label="Currency"
                value={prefs.currency}
                options={CURRENCY_OPTIONS}
                onChange={(currency) => patch({ currency })}
                preview={currencyPreview}
                help="Formatted using your selected number format."
              />
            </div>

            <div className="st-section">
              <div className="st-section__head">
                <h2 className="st-section__title">Timezone</h2>
                <p className="st-section__hint">
                  Times are shown relative to this zone. Defaults to your
                  system setting.
                </p>
              </div>
              <Field
                id="l10n-timezone"
                label="Timezone"
                value={prefs.timeZone}
                options={timeZoneOptions}
                onChange={(timeZone) => patch({ timeZone })}
                preview={timeZonePreview}
                help={`${timeZones.length} zones available.`}
              />
            </div>

            <div className="st-section">
              <div className="st-section__head">
                <h2 className="st-section__title">First day of week</h2>
                <p className="st-section__hint">
                  The day calendars and date pickers start on.
                </p>
              </div>
              <Field
                id="l10n-first-day"
                label="Week starts on"
                value={String(prefs.firstDayOfWeek)}
                options={FIRST_DAY_OPTIONS.map((o) => ({
                  value: String(o.value),
                  label: o.label,
                }))}
                onChange={(value) =>
                  patch({
                    firstDayOfWeek: Number(value) as L10nFirstDayOfWeek,
                  })
                }
                preview={firstDayPreview}
              />
            </div>

            <div className="st-section">
              <div className="st-section__head">
                <h2 className="st-section__title">Summary</h2>
                <p className="st-section__hint">
                  Everything together, exactly as it will appear.
                </p>
              </div>
              <div className="st-l10n-summary">
                <span className="st-l10n-summary__key">Date</span>
                <span className="st-l10n-summary__val">{datePreview.value}</span>
                <span className="st-l10n-summary__key">Time</span>
                <span className="st-l10n-summary__val">{timePreview.value}</span>
                <span className="st-l10n-summary__key">Number</span>
                <span className="st-l10n-summary__val">
                  {numberPreview.value}
                </span>
                <span className="st-l10n-summary__key">Currency</span>
                <span className="st-l10n-summary__val">
                  {currencyPreview.value}
                </span>
                <span className="st-l10n-summary__key">Timezone</span>
                <span className="st-l10n-summary__val">
                  {timeZonePreview.value}
                </span>
                <span className="st-l10n-summary__key">Week order</span>
                <span className="st-l10n-summary__val">
                  {firstDayPreview.value}
                </span>
              </div>
              <div className="st-form-actions">
                <TwentyButton variant="secondary" onClick={handleReset}>
                  Reset to defaults
                </TwentyButton>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
