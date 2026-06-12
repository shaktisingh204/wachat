/**
 * SabCRM — shared phone normalization (E.164) + matching helpers.
 *
 * The SINGLE place phone strings are parsed / normalized for SabCRM:
 *
 *   - {@link digitsOnly} / {@link toE164} / {@link toWaId} — normalization.
 *     `toE164` produces `'+<cc><nsn>'`; bare 10-digit national numbers get the
 *     default calling code (env `SABCRM_DEFAULT_CC`, fallback `'91'`); inputs
 *     with fewer than 8 digits are rejected (`null`).
 *   - {@link digitTolerantRegex} — a Mongo `$regex` source that matches a
 *     stored display phone ("+91 98765 43210", "098765-43210", "9876543210")
 *     against a digits-only WhatsApp id, anchored on the LAST 10 digits.
 *   - {@link phoneFromValue} / {@link firstRecordPhone} — canonical readers
 *     for PHONE / PHONES field values incl. Twenty's
 *     `{ primaryPhoneNumber, primaryPhoneCallingCode, additionalPhones[] }`
 *     composite (moved here from `sabcrm-comms.actions.ts`).
 *   - {@link normalizePhoneFields} — write-time E.164 rewrite for plain-string
 *     PHONE fields (callers gate it behind `SABCRM_NORMALIZE_PHONES=1`).
 *
 * Plain TS on purpose: NO `server-only`, NO Next imports — unit-testable with
 * `npx tsx --test src/lib/sabcrm/__tests__/phone.test.ts`.
 */

import type { ObjectMetadata } from './types';

// ---------------------------------------------------------------------------
// Core normalization
// ---------------------------------------------------------------------------

/** Strip every non-digit character. */
export function digitsOnly(raw: string): string {
  return (raw || '').replace(/[^\d]/g, '');
}

/** The default calling code for bare national numbers (no leading `+`). */
function defaultCallingCode(explicit?: string): string {
  const cc = digitsOnly(explicit ?? process.env.SABCRM_DEFAULT_CC ?? '');
  return cc || '91';
}

/**
 * Normalize a display phone to E.164 (`'+<cc><nsn>'`). Best-effort, no
 * libphonenumber:
 *
 *   - `+…` prefixed input → digits are taken verbatim as `<cc><nsn>`,
 *   - `00…` international-prefix input → the `00` is dropped, the rest is
 *     `<cc><nsn>`,
 *   - bare 10-digit national numbers (optionally with one trunk `0`) get the
 *     default calling code (`defaultCc` param → env `SABCRM_DEFAULT_CC` →
 *     `'91'`),
 *   - anything else with ≥ 8 digits is assumed to already carry its country
 *     code,
 *   - fewer than 8 digits ⇒ `null` (not dialable).
 */
export function toE164(raw: string, defaultCc?: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith('+');
  let digits = digitsOnly(trimmed);

  // "00" international dialing prefix → equivalent to a leading "+".
  const hasIntlPrefix = !hasPlus && digits.startsWith('00');
  if (hasIntlPrefix) digits = digits.slice(2);

  if (digits.length < 8) return null;
  if (hasPlus || hasIntlPrefix) return `+${digits}`;

  // National trunk "0" + 10-digit number (e.g. "098765-43210").
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  // Bare 10-digit national number → prepend the default calling code.
  if (digits.length === 10) return `+${defaultCallingCode(defaultCc)}${digits}`;

  // 8+ digits with no prefix hints: assume the country code is included.
  return `+${digits}`;
}

/** WhatsApp id (E.164 without the `+`), or `null` when not normalizable. */
export function toWaId(raw: string, defaultCc?: string): string | null {
  const e164 = toE164(raw, defaultCc);
  return e164 ? e164.slice(1) : null;
}

/**
 * Mongo `$regex` source matching a STORED display phone against a digits-only
 * id. Interleaves `[^0-9]*` between digits and anchors on the LAST 10 digits
 * (the national number) so `"+91 98765 43210"`, `"098765-43210"` and
 * `"9876543210"` all match `waId = "919876543210"`. Anchored at the end of
 * the string (trailing non-digits tolerated).
 */
export function digitTolerantRegex(digits: string): string {
  const d = digitsOnly(digits);
  const tail = d.length > 10 ? d.slice(-10) : d;
  if (!tail) return '$^'; // never matches
  return `${tail.split('').join('[^0-9]*')}[^0-9]*$`;
}

// ---------------------------------------------------------------------------
// PHONE / PHONES value readers (moved verbatim from sabcrm-comms.actions.ts)
// ---------------------------------------------------------------------------

/** Narrow an unknown to a plain object record (helper for composites). */
function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** First non-empty string among the candidates. */
function firstString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/**
 * Pull ONE dialable phone string out of a PHONE / PHONES field value.
 * Tolerates plain strings, arrays of strings / objects and Twenty's
 * `{ primaryPhoneNumber, primaryPhoneCallingCode, additionalPhones[] }`
 * composite (the same shapes `parsePhones` in the 20ui field renderers
 * accepts).
 */
export function phoneFromValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const p = phoneFromValue(item);
      if (p) return p;
    }
    return '';
  }
  const rec = asRecord(value);
  if (!rec) return '';
  const number = firstString(
    rec.number,
    rec.primaryPhoneNumber,
    rec.phoneNumber,
    rec.value,
  );
  if (!number) {
    const extra = rec.additionalPhones ?? rec.additionalPhoneNumbers;
    return Array.isArray(extra) ? phoneFromValue(extra) : '';
  }
  const calling = firstString(
    rec.callingCode,
    rec.primaryPhoneCallingCode,
    rec.countryCode,
    rec.primaryPhoneCountryCode,
  );
  if (!calling) return number;
  const prefix = calling.startsWith('+')
    ? calling
    : `+${calling.replace(/[^\d]/g, '')}`;
  return `${prefix} ${number}`;
}

/**
 * The record's first phone: object metadata decides which `data.*` keys are
 * PHONE / PHONES fields (in field order); the common bare keys `phone` /
 * `phones` are the fallback for objects without typed phone fields.
 */
export function firstRecordPhone(
  object: ObjectMetadata | null,
  data: Record<string, unknown>,
): string {
  const keys: string[] = [];
  for (const f of object?.fields ?? []) {
    if (f.type === 'PHONE' || f.type === 'PHONES') keys.push(f.key);
  }
  for (const k of ['phone', 'phones']) {
    if (!keys.includes(k)) keys.push(k);
  }
  for (const key of keys) {
    const p = phoneFromValue(data[key]);
    if (p) return p;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Write-time normalization (callers gate behind SABCRM_NORMALIZE_PHONES=1)
// ---------------------------------------------------------------------------

/** The minimal field-metadata shape {@link normalizePhoneFields} needs. */
export interface PhoneFieldLike {
  key: string;
  type: string;
}

/**
 * Rewrite every PHONE-typed field whose value is a plain string to
 * `toE164(value) ?? value` (non-destructive: unparseable input passes through
 * verbatim). PHONES composites are NOT touched — their sub-shape is owned by
 * the field editor. Returns a NEW object only when something changed.
 */
export function normalizePhoneFields(
  fields: readonly PhoneFieldLike[] | undefined,
  data: Record<string, unknown>,
  defaultCc?: string,
): Record<string, unknown> {
  if (!fields || fields.length === 0) return data;
  let out: Record<string, unknown> | null = null;
  for (const f of fields) {
    if (f.type !== 'PHONE') continue;
    const value = data[f.key];
    if (typeof value !== 'string' || !value.trim()) continue;
    const normalized = toE164(value, defaultCc) ?? value;
    if (normalized === value) continue;
    if (!out) out = { ...data };
    out[f.key] = normalized;
  }
  return out ?? data;
}
