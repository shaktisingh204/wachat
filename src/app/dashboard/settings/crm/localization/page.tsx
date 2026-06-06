'use client';

/**
 * SabCRM - Localization settings (`/dashboard/settings/crm/localization`).
 *
 * Device-scoped regional + formatting controls. Every option drives a live
 * preview built from the browser's `Intl` APIs, so users see exactly how
 * dates, times, numbers and currencies will render under their choice:
 *
 *   - Language        - base BCP-47 locale for every preview.
 *   - Date format     - preset mapped to `Intl.DateTimeFormat` options.
 *   - Time format     - 12h / 24h (toggles `hour12`).
 *   - Number format   - decimal / grouping separator convention.
 *   - Default currency - ISO-4217 code, previewed via `Intl.NumberFormat`.
 *   - Timezone        - IANA zone (uses `Intl.supportedValuesOf` when present,
 *                       else a curated subset), previewed against "now".
 *   - First day of week - Sunday / Monday / Saturday.
 *
 * Choices persist to BOTH the gated CRM settings document on the backend (via
 * `useSettingsSync('localization', ...)` -> the `getCrmSettingsTw` /
 * `updateCrmSettingsTw` server actions) AND the local `useL10nPrefs` cache, so a
 * user's regional setup follows them across devices while the page never blocks.
 * When the Rust settings engine is down the page degrades to the device-local
 * cache and shows an "offline" note. The page renders a skeleton until hydrated,
 * and every `Intl` call is guarded so an unsupported locale / zone degrades to a
 * readable fallback rather than throwing.
 *
 * Pure 20ui: every control comes from `@/components/sabcrm/20ui`. The enclosing
 * settings shell establishes the `ui20 sabcrm-twenty` scope, so all `--st-*` /
 * `--u-*` tokens resolve here.
 */

import * as React from 'react';
import { Languages, RotateCcw } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Field,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Button,
  Skeleton,
  Alert,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useL10nPrefs,
  type L10nPrefs,
  type L10nTimeFormat,
  type L10nFirstDayOfWeek,
} from './use-l10n-prefs';
import { useSettingsSync } from '../use-settings-sync';

/**
 * Narrow the raw stored value into a usable localization slice. Only requires an
 * object - `useL10nPrefs.setPrefs` merges field-by-field and the hook's own
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
    label: 'Short, e.g. 6/3/26',
    options: { year: '2-digit', month: 'numeric', day: 'numeric' },
  },
  {
    value: 'medium',
    label: 'Medium, e.g. Jun 3, 2026',
    options: { year: 'numeric', month: 'short', day: 'numeric' },
  },
  {
    value: 'long',
    label: 'Long, e.g. June 3, 2026',
    options: { year: 'numeric', month: 'long', day: 'numeric' },
  },
  {
    value: 'full',
    label: 'Full, e.g. Wednesday, June 3, 2026',
    options: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  },
  {
    value: 'numeric',
    label: 'Numeric, e.g. 2026-06-03',
    options: { year: 'numeric', month: '2-digit', day: '2-digit' },
  },
];

const TIME_FORMAT_OPTIONS: Array<{ value: L10nTimeFormat; label: string }> = [
  { value: '12h', label: '12-hour, e.g. 2:30 PM' },
  { value: '24h', label: '24-hour, e.g. 14:30' },
];

/**
 * The "number format" choice is expressed as the formatting locale that yields
 * the desired grouping / decimal separators. Kept separate from `language` so a
 * user can keep an English UI while preferring European number conventions.
 */
const NUMBER_FORMAT_OPTIONS: Option[] = [
  { value: 'en-US', label: '1,234,567.89  (comma group, dot decimal)' },
  { value: 'de-DE', label: '1.234.567,89  (dot group, comma decimal)' },
  { value: 'fr-FR', label: '1 234 567,89  (space group, comma decimal)' },
  { value: 'en-IN', label: '12,34,567.89  (Indian grouping)' },
  { value: 'de-CH', label: "1'234'567.89  (apostrophe group, dot decimal)" },
];

const CURRENCY_OPTIONS: Option[] = [
  { value: 'USD', label: 'USD, US Dollar' },
  { value: 'EUR', label: 'EUR, Euro' },
  { value: 'GBP', label: 'GBP, British Pound' },
  { value: 'INR', label: 'INR, Indian Rupee' },
  { value: 'JPY', label: 'JPY, Japanese Yen' },
  { value: 'CNY', label: 'CNY, Chinese Yuan' },
  { value: 'BRL', label: 'BRL, Brazilian Real' },
  { value: 'CAD', label: 'CAD, Canadian Dollar' },
  { value: 'AUD', label: 'AUD, Australian Dollar' },
  { value: 'CHF', label: 'CHF, Swiss Franc' },
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

/**
 * Radix Select forbids an empty-string item value, so the "System default"
 * timezone (stored as `''`) is represented in the listbox by this sentinel and
 * translated back to `''` on change / when reading the current value.
 */
const SYSTEM_TZ_SENTINEL = '__system__';

/* -------------------------------------------------------------------------
   Intl helpers - every call is guarded so a bad locale / zone never throws
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
    // 2024-01-07 is a Sunday, so index 0 lines up with getDay().
    const days = Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2024, 0, 7 + ((prefs.firstDayOfWeek + i) % 7))),
    );
    return days.join('  ');
  });
}

/* -------------------------------------------------------------------------
   Small presentational pieces
   ---------------------------------------------------------------------- */

/** A live, token-styled preview row beneath a control. */
function Preview({
  label,
  result,
}: {
  label: string;
  result: { value: string; ok: boolean };
}): React.JSX.Element {
  return (
    <div
      className="mt-[var(--st-space-2)] flex items-baseline gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-[var(--st-space-3)] py-[var(--st-space-2)]"
      aria-live="polite"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {label}
      </span>
      <span
        className={
          result.ok
            ? 'font-mono text-[13px] text-[var(--st-text)]'
            : 'font-mono text-[13px] text-[var(--st-text-tertiary)]'
        }
      >
        {result.value}
      </span>
    </div>
  );
}

/**
 * A single localization control: a labelled 20ui Select with optional helper
 * text and a live preview. The empty-string timezone value is mapped to a
 * sentinel for Radix and translated back on change.
 */
function L10nField({
  label,
  value,
  options,
  onChange,
  preview,
  help,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (next: string) => void;
  preview: { value: string; ok: boolean };
  help?: string;
}): React.JSX.Element {
  const selectValue = value === '' ? SYSTEM_TZ_SENTINEL : value;
  return (
    <Field label={label} help={help}>
      <Select
        value={selectValue}
        onValueChange={(next) =>
          onChange(next === SYSTEM_TZ_SENTINEL ? '' : next)
        }
      >
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value === '' ? SYSTEM_TZ_SENTINEL : opt.value}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Preview label="Preview" result={preview} />
    </Field>
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
    toast.success('Regional and formatting preferences restored to defaults.');
  }, [reset, sync, toast]);

  // Derive every preview from the current prefs (cheap; recomputed per render).
  const datePreview = previewDate(prefs);
  const timePreview = previewTime(prefs);
  const numberPreview = previewNumber(prefs);
  const currencyPreview = previewCurrency(prefs);
  const timeZonePreview = previewTimeZone(prefs);
  const firstDayPreview = previewFirstDay(prefs);

  const summaryRows: Array<{ key: string; value: string }> = [
    { key: 'Date', value: datePreview.value },
    { key: 'Time', value: timePreview.value },
    { key: 'Number', value: numberPreview.value },
    { key: 'Currency', value: currencyPreview.value },
    { key: 'Timezone', value: timeZonePreview.value },
    { key: 'Week order', value: firstDayPreview.value },
  ];

  return (
    <div className="flex flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-[var(--st-space-2)]">
              <Languages size={18} aria-hidden="true" />
              Localization
            </span>
          </PageTitle>
          <PageDescription>
            Choose how dates, times, numbers and currencies are displayed in
            SabCRM. Each preview updates live. Saved to your workspace so your
            regional setup follows you across devices.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {sync.phase === 'offline' ? (
        <Alert tone="warning" title="Settings service offline">
          Changes are kept on this device for now.
        </Alert>
      ) : null}

      {!hydrated ? (
        <Card>
          <CardBody>
            <div
              className="flex flex-col gap-[var(--st-space-4)]"
              aria-busy="true"
              aria-live="polite"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-[var(--st-space-2)]">
                  <Skeleton width={120} height={12} />
                  <Skeleton height={32} />
                </div>
              ))}
              <span className="text-[13px] text-[var(--st-text-secondary)]">
                Loading your preferences.
              </span>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-5)]">
          <Card>
            <CardHeader>
              <CardTitle>Language</CardTitle>
              <CardDescription>
                The base locale used to format dates, times and names.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <L10nField
                label="Display language"
                value={prefs.language}
                options={LANGUAGE_OPTIONS}
                onChange={(language) => patch({ language })}
                preview={datePreview}
                help="More UI translations are coming soon; formatting applies now."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Date format</CardTitle>
              <CardDescription>
                How calendar dates are written throughout SabCRM.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <L10nField
                label="Date format"
                value={prefs.dateFormat}
                options={DATE_FORMAT_PRESETS.map((p) => ({
                  value: p.value,
                  label: p.label,
                }))}
                onChange={(dateFormat) => patch({ dateFormat })}
                preview={datePreview}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time format</CardTitle>
              <CardDescription>
                Use a 12-hour clock with AM/PM, or a 24-hour clock.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <L10nField
                label="Time format"
                value={prefs.timeFormat}
                options={TIME_FORMAT_OPTIONS}
                onChange={(value) =>
                  patch({ timeFormat: value as L10nTimeFormat })
                }
                preview={timePreview}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Number format</CardTitle>
              <CardDescription>
                Controls the grouping and decimal separators for numbers.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <L10nField
                label="Decimal and grouping separators"
                value={prefs.numberFormat}
                options={NUMBER_FORMAT_OPTIONS}
                onChange={(numberFormat) => patch({ numberFormat })}
                preview={numberPreview}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default currency</CardTitle>
              <CardDescription>
                The currency used when displaying monetary amounts.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <L10nField
                label="Currency"
                value={prefs.currency}
                options={CURRENCY_OPTIONS}
                onChange={(currency) => patch({ currency })}
                preview={currencyPreview}
                help="Formatted using your selected number format."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timezone</CardTitle>
              <CardDescription>
                Times are shown relative to this zone. Defaults to your system
                setting.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <L10nField
                label="Timezone"
                value={prefs.timeZone}
                options={timeZoneOptions}
                onChange={(timeZone) => patch({ timeZone })}
                preview={timeZonePreview}
                help={`${timeZones.length} zones available.`}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>First day of week</CardTitle>
              <CardDescription>
                The day calendars and date pickers start on.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <L10nField
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
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>
                Everything together, exactly as it will appear.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-[auto_1fr] gap-x-[var(--st-space-5)] gap-y-[var(--st-space-3)]">
                {summaryRows.map((row) => (
                  <React.Fragment key={row.key}>
                    <dt className="text-[13px] font-medium text-[var(--st-text-secondary)]">
                      {row.key}
                    </dt>
                    <dd className="font-mono text-[13px] text-[var(--st-text)]">
                      {row.value}
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
            </CardBody>
            <CardFooter>
              <Button
                variant="secondary"
                iconLeft={RotateCcw}
                onClick={handleReset}
              >
                Reset to defaults
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
