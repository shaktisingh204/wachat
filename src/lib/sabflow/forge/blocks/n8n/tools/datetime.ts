/**
 * Forge block: DateTime
 *
 * Source: n8n-master/packages/nodes-base/nodes/DateTime/DateTime.node.ts (V1+V2)
 * Credential: none — local computation.
 *
 * Operations covered:
 *   - format-date         Reformat / locale-format a date string
 *   - parse-date          Parse a date string + return ISO + epoch ms
 *   - add-duration        Add (years/months/days/hours/minutes/seconds) to a date
 *   - subtract-duration   Subtract a duration from a date
 *   - diff-dates          Difference between two dates in a chosen unit
 *
 * Deferred:
 *   - timezone-aware arithmetic with DST roll-overs (n8n uses moment-tz; here
 *     we use the native Date in the runtime's local TZ unless the input is ISO
 *     with an offset). Add `luxon` to the project to enable robust TZ math.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

function parseDate(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('DateTime: date value is required');
  // Numeric input → epoch ms (or seconds if it's small enough to be obvious).
  if (/^-?\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    const ms = trimmed.length <= 10 ? n * 1000 : n;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) throw new Error(`DateTime: cannot parse "${value}"`);
    return d;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) throw new Error(`DateTime: cannot parse "${value}"`);
  return d;
}

type Unit = 'years' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds' | 'milliseconds';

function applyDuration(date: Date, amount: number, unit: Unit, sign: 1 | -1): Date {
  const d = new Date(date.getTime());
  const a = amount * sign;
  switch (unit) {
    case 'years':
      d.setFullYear(d.getFullYear() + a);
      break;
    case 'months':
      d.setMonth(d.getMonth() + a);
      break;
    case 'weeks':
      d.setDate(d.getDate() + a * 7);
      break;
    case 'days':
      d.setDate(d.getDate() + a);
      break;
    case 'hours':
      d.setHours(d.getHours() + a);
      break;
    case 'minutes':
      d.setMinutes(d.getMinutes() + a);
      break;
    case 'seconds':
      d.setSeconds(d.getSeconds() + a);
      break;
    case 'milliseconds':
      d.setMilliseconds(d.getMilliseconds() + a);
      break;
  }
  return d;
}

function diffUnits(a: Date, b: Date, unit: Unit): number {
  const ms = b.getTime() - a.getTime();
  switch (unit) {
    case 'milliseconds':
      return ms;
    case 'seconds':
      return ms / 1000;
    case 'minutes':
      return ms / 60_000;
    case 'hours':
      return ms / 3_600_000;
    case 'days':
      return ms / 86_400_000;
    case 'weeks':
      return ms / (7 * 86_400_000);
    case 'months': {
      // Average month length; suitable for reporting, not calendar-accurate.
      return ms / (30.4375 * 86_400_000);
    }
    case 'years':
      return ms / (365.25 * 86_400_000);
  }
}

function readUnit(v: unknown, fallback: Unit = 'days'): Unit {
  const s = asString(v).toLowerCase();
  const all: Unit[] = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds'];
  return (all as string[]).includes(s) ? (s as Unit) : fallback;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function formatDate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const date = parseDate(asString(ctx.options.date));
  const fmt = asString(ctx.options.format) || 'iso';
  const locale = asString(ctx.options.locale) || undefined;
  const tz = asString(ctx.options.timezone) || undefined;

  let formatted: string;
  if (fmt === 'iso') {
    formatted = date.toISOString();
  } else if (fmt === 'epoch-ms') {
    formatted = String(date.getTime());
  } else if (fmt === 'epoch-s') {
    formatted = String(Math.floor(date.getTime() / 1000));
  } else if (fmt === 'rfc2822') {
    formatted = date.toUTCString();
  } else if (fmt === 'date') {
    formatted = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeZone: tz,
    }).format(date);
  } else if (fmt === 'datetime') {
    formatted = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: tz,
    }).format(date);
  } else {
    // Fallback: treat fmt as a locale-formatted ISO substring (YYYY-MM-DD etc).
    formatted = date.toISOString().slice(0, fmt.length || 10);
  }

  return {
    outputs: { formatted, iso: date.toISOString(), epochMs: date.getTime() },
    logs: [`DateTime format → ${formatted}`],
  };
}

async function parseDateAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const date = parseDate(asString(ctx.options.date));
  return {
    outputs: {
      iso: date.toISOString(),
      epochMs: date.getTime(),
      epochSeconds: Math.floor(date.getTime() / 1000),
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      weekday: date.getUTCDay(),
    },
    logs: [`DateTime parse → ${date.toISOString()}`],
  };
}

async function addDuration(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const date = parseDate(asString(ctx.options.date));
  const amount = asNumber(ctx.options.amount);
  if (amount === undefined) throw new Error('DateTime: amount is required');
  const unit = readUnit(ctx.options.unit);
  const out = applyDuration(date, amount, unit, 1);
  return {
    outputs: { iso: out.toISOString(), epochMs: out.getTime() },
    logs: [`DateTime add ${amount}${unit} → ${out.toISOString()}`],
  };
}

async function subtractDuration(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const date = parseDate(asString(ctx.options.date));
  const amount = asNumber(ctx.options.amount);
  if (amount === undefined) throw new Error('DateTime: amount is required');
  const unit = readUnit(ctx.options.unit);
  const out = applyDuration(date, amount, unit, -1);
  return {
    outputs: { iso: out.toISOString(), epochMs: out.getTime() },
    logs: [`DateTime subtract ${amount}${unit} → ${out.toISOString()}`],
  };
}

async function diffDates(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const start = parseDate(asString(ctx.options.start));
  const end = parseDate(asString(ctx.options.end));
  const unit = readUnit(ctx.options.unit);
  const diff = diffUnits(start, end, unit);
  return {
    outputs: { diff, unit, absolute: Math.abs(diff) },
    logs: [`DateTime diff → ${diff} ${unit}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const unitOptions = [
  { label: 'Years', value: 'years' },
  { label: 'Months', value: 'months' },
  { label: 'Weeks', value: 'weeks' },
  { label: 'Days', value: 'days' },
  { label: 'Hours', value: 'hours' },
  { label: 'Minutes', value: 'minutes' },
  { label: 'Seconds', value: 'seconds' },
  { label: 'Milliseconds', value: 'milliseconds' },
];

const block: ForgeBlock = {
  id: 'forge_datetime',
  name: 'Date & Time',
  description: 'Parse, format and do arithmetic on dates using the native runtime.',
  iconName: 'LuCalendarClock',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'format_date',
      label: 'Format date',
      description: 'Format a date into ISO, epoch, locale-aware date/time, etc.',
      fields: [
        { id: 'date', label: 'Date', type: 'text', required: true, placeholder: '2024-01-15T10:30:00Z' },
        {
          id: 'format',
          label: 'Format',
          type: 'select',
          defaultValue: 'iso',
          options: [
            { label: 'ISO 8601', value: 'iso' },
            { label: 'Epoch ms', value: 'epoch-ms' },
            { label: 'Epoch seconds', value: 'epoch-s' },
            { label: 'RFC 2822 / UTC string', value: 'rfc2822' },
            { label: 'Locale date', value: 'date' },
            { label: 'Locale date + time', value: 'datetime' },
          ],
        },
        { id: 'locale', label: 'Locale (e.g. en-US)', type: 'text' },
        { id: 'timezone', label: 'Timezone (IANA, e.g. UTC)', type: 'text' },
      ],
      run: formatDate,
    },
    {
      id: 'parse_date',
      label: 'Parse date',
      description: 'Parse a date string and emit ISO + epoch components.',
      fields: [
        { id: 'date', label: 'Date', type: 'text', required: true },
      ],
      run: parseDateAction,
    },
    {
      id: 'add_duration',
      label: 'Add duration',
      description: 'Add a duration to a date.',
      fields: [
        { id: 'date', label: 'Date', type: 'text', required: true },
        { id: 'amount', label: 'Amount', type: 'number', required: true },
        { id: 'unit', label: 'Unit', type: 'select', defaultValue: 'days', options: unitOptions },
      ],
      run: addDuration,
    },
    {
      id: 'subtract_duration',
      label: 'Subtract duration',
      description: 'Subtract a duration from a date.',
      fields: [
        { id: 'date', label: 'Date', type: 'text', required: true },
        { id: 'amount', label: 'Amount', type: 'number', required: true },
        { id: 'unit', label: 'Unit', type: 'select', defaultValue: 'days', options: unitOptions },
      ],
      run: subtractDuration,
    },
    {
      id: 'diff_dates',
      label: 'Difference between dates',
      description: 'Return the signed difference between two dates in a unit.',
      fields: [
        { id: 'start', label: 'Start date', type: 'text', required: true },
        { id: 'end', label: 'End date', type: 'text', required: true },
        { id: 'unit', label: 'Unit', type: 'select', defaultValue: 'days', options: unitOptions },
      ],
      run: diffDates,
    },
  ],
};

registerForgeBlock(block);
export default block;
