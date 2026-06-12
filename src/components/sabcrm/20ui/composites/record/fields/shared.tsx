'use client';

/**
 * RecordSurface field system — shared contract + value helpers.
 *
 * The value parsing/formatting logic is ported from
 * `src/components/sabcrm/twenty/twenty-field.tsx` (the Twenty-faithful field
 * renderer); the presentation layer is rebuilt on 20ui primitives. Every
 * helper is tolerant of the multiple stored shapes Twenty produced (composite
 * objects, bare strings, arrays) so old records keep rendering.
 */

import * as React from 'react';

import type { CrmRecord, FieldMetadata } from '@/lib/sabcrm/types';

/* =========================================================================
   Contract
   ========================================================================= */

/** Caller-injected formatters (all optional; sane defaults apply). */
export interface RecordCellFmt {
  date?: (v: Date) => string;
  number?: (v: number) => string;
  currency?: (v: number, code?: string) => string;
}

/** Fully-resolved formatters handed to every field component. */
export interface ResolvedFmt {
  date: (v: unknown) => string;
  dateTime: (v: unknown) => string;
  number: (v: unknown) => string;
  currency: (v: unknown, code?: string) => string;
}

/** Resolves relation display labels + search options. No server calls inside. */
export interface RelationResolver {
  label: (field: FieldMetadata, value: unknown) => string | null;
  search?: (
    field: FieldMetadata,
    q: string,
  ) => Promise<Array<{ id: string; label: string }>>;
}

export interface FieldDisplayProps {
  field: FieldMetadata;
  value: unknown;
  record?: CrmRecord;
  fmt: ResolvedFmt;
  relationResolver?: RelationResolver;
}

export interface FieldEditorProps extends FieldDisplayProps {
  /** Commit the next value (Enter / blur / pick). */
  onCommit: (next: unknown) => void;
  /** Abandon the edit (Escape). */
  onCancel: () => void;
}

export type FieldDisplayComponent = React.ComponentType<FieldDisplayProps>;
export type FieldEditorComponent = React.ComponentType<FieldEditorProps>;

/* =========================================================================
   Default formatters
   ========================================================================= */

export function toDate(value: unknown): Date | null {
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

const defaultDate = (v: unknown): string => {
  const d = toDate(v);
  if (!d) return v == null ? '' : String(v);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const defaultDateTime = (v: unknown): string => {
  const d = toDate(v);
  if (!d) return v == null ? '' : String(v);
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${defaultDate(d)} · ${time}`;
};

const defaultNumber = (v: unknown): string => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return v == null ? '' : String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const defaultCurrency = (v: unknown, code = 'USD'): string => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return v == null ? '' : String(v);
  try {
    return n.toLocaleString(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${defaultNumber(n)} ${code}`;
  }
};

export const DEFAULT_FMT: ResolvedFmt = {
  date: defaultDate,
  dateTime: defaultDateTime,
  number: defaultNumber,
  currency: defaultCurrency,
};

/**
 * Overlay the caller's optional formatters on a base (workspace-settings or
 * default) formatter set. The caller's `date` covers DATE_TIME's date part too.
 */
export function resolveFmt(
  custom: RecordCellFmt | undefined,
  base: ResolvedFmt = DEFAULT_FMT,
): ResolvedFmt {
  if (!custom) return base;
  const date = custom.date
    ? (v: unknown): string => {
        const d = toDate(v);
        return d ? custom.date!(d) : base.date(v);
      }
    : base.date;
  const dateTime = custom.date
    ? (v: unknown): string => {
        const d = toDate(v);
        if (!d) return base.dateTime(v);
        const time = d.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        });
        return `${custom.date!(d)} · ${time}`;
      }
    : base.dateTime;
  const number = custom.number
    ? (v: unknown): string => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? custom.number!(n) : base.number(v);
      }
    : base.number;
  const currency = custom.currency
    ? (v: unknown, code?: string): string => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? custom.currency!(n, code) : base.currency(v, code);
      }
    : base.currency;
  return { date, dateTime, number, currency };
}

/* =========================================================================
   Generic value helpers (ported from twenty-field.tsx)
   ========================================================================= */

/** Treat null / undefined / empty-string as "no value". */
export function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/** Narrow an unknown to a plain object record (or null). */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** First non-empty string among the candidates. */
export function firstString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
    if (typeof c === 'number' && !Number.isNaN(c)) return String(c);
  }
  return '';
}

/**
 * Resolve a SELECT / MULTI_SELECT option color into a concrete CSS color.
 * Hex / rgb / hsl pass through; `--token` becomes `var(--token)`; a bare word
 * tries the `--ui20-*` palette with the word itself as fallback.
 */
export function optionColor(color?: string): string | undefined {
  if (!color) return undefined;
  if (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl')) {
    return color;
  }
  if (color.startsWith('--')) return `var(${color})`;
  if (/^[a-z][a-z0-9-]*$/i.test(color)) return `var(--ui20-${color}, ${color})`;
  return undefined;
}

/** Strip protocol / path so a link reads as a clean host (Twenty style). */
export function linkLabel(url: string): string {
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname !== '/' ? u.pathname : ''}`;
  } catch {
    return url;
  }
}

/** Prefix a bare host with https:// so anchors always resolve. */
export function toHref(url: string): string {
  return url.includes('://') ? url : `https://${url}`;
}

/* =========================================================================
   Composite-value parsing (ported from twenty-field.tsx)
   ========================================================================= */

/**
 * Resolve a CURRENCY value into `{ amount, code, micros }`. Tolerates Twenty's
 * `{ amountMicros, currencyCode }` (micros = amount × 1e6), the simpler
 * `{ amount, currencyCode }`, and a plain number fallback. `micros` reports
 * whether the stored shape was micros-based so editors can round-trip it.
 */
export function parseCurrency(
  value: unknown,
): { amount: number; code: string; micros: boolean } | null {
  const rec = asRecord(value);
  if (rec) {
    const code = firstString(rec.currencyCode, rec.code) || 'USD';
    if (rec.amountMicros !== undefined && rec.amountMicros !== null) {
      const micros = Number(rec.amountMicros);
      if (!Number.isNaN(micros)) {
        return { amount: micros / 1_000_000, code, micros: true };
      }
    }
    const amount = Number(rec.amount);
    if (!Number.isNaN(amount)) return { amount, code, micros: false };
    return null;
  }
  const n = Number(value);
  return Number.isNaN(n) ? null : { amount: n, code: 'USD', micros: false };
}

/** A normalised `{ label, url }` link. */
export interface NormLink {
  label: string;
  url: string;
}

/**
 * Normalise a LINKS value into a flat list of `{ label, url }`. Tolerates an
 * array of `{ label, url }`, an array of bare url strings, or Twenty's
 * `{ primaryLinkUrl, primaryLinkLabel, secondaryLinks }` composite.
 */
export function parseLinks(value: unknown): NormLink[] {
  const out: NormLink[] = [];
  const push = (raw: unknown): void => {
    if (typeof raw === 'string' && raw.trim()) {
      out.push({ url: raw, label: '' });
      return;
    }
    const rec = asRecord(raw);
    if (rec) {
      const url = firstString(rec.url, rec.primaryLinkUrl, rec.href);
      const label = firstString(rec.label, rec.primaryLinkLabel, rec.name);
      if (url || label) out.push({ url, label });
    }
  };
  if (Array.isArray(value)) {
    value.forEach(push);
    return out;
  }
  const rec = asRecord(value);
  if (rec) {
    push({ url: rec.primaryLinkUrl, label: rec.primaryLinkLabel });
    if (Array.isArray(rec.secondaryLinks)) rec.secondaryLinks.forEach(push);
    if (out.length) return out;
  }
  push(value);
  return out;
}

/**
 * Normalise an EMAILS-style value into a flat string list. Tolerates a plain
 * array, a single string, or Twenty's `{ primaryX, additionalX }` composite.
 */
export function parseStringList(
  value: unknown,
  primaryKey: string,
  listKey: string,
): string[] {
  const itemOf = (v: unknown): string =>
    asRecord(v)
      ? firstString(
          (v as Record<string, unknown>).number,
          (v as Record<string, unknown>).email,
          (v as Record<string, unknown>).value,
        )
      : String(v);
  if (Array.isArray(value)) {
    return value.map(itemOf).filter((s) => s.trim());
  }
  const rec = asRecord(value);
  if (rec) {
    const out: string[] = [];
    const primary = firstString(rec[primaryKey]);
    if (primary) out.push(primary);
    const extra = rec[listKey];
    if (Array.isArray(extra)) {
      extra.forEach((v) => {
        const s = itemOf(v);
        if (s.trim()) out.push(s);
      });
    }
    return out;
  }
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

/**
 * Normalise a PHONES value into a flat list of `{ display, dial }`. Tolerates
 * Twenty's `{ primaryPhoneNumber, primaryPhoneCountryCode,
 * primaryPhoneCallingCode, additionalPhones[] }` composite, a plain array of
 * strings / objects, or a single string.
 */
export function parsePhones(value: unknown): Array<{ display: string; dial: string }> {
  const out: Array<{ display: string; dial: string }> = [];
  const pushPhone = (raw: unknown): void => {
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (s) out.push({ display: s, dial: s });
      return;
    }
    const rec = asRecord(raw);
    if (!rec) return;
    const number = firstString(rec.number, rec.primaryPhoneNumber, rec.phoneNumber, rec.value);
    if (!number) return;
    const calling = firstString(
      rec.callingCode,
      rec.primaryPhoneCallingCode,
      rec.countryCode,
      rec.primaryPhoneCountryCode,
    );
    const prefix = calling
      ? calling.startsWith('+')
        ? calling
        : `+${calling.replace(/[^\d]/g, '')}`
      : '';
    const display = prefix ? `${prefix} ${number}` : number;
    out.push({ display, dial: `${prefix}${number}`.replace(/\s+/g, '') });
  };

  if (Array.isArray(value)) {
    value.forEach(pushPhone);
    return out;
  }
  const rec = asRecord(value);
  if (rec) {
    pushPhone(rec);
    const extra = rec.additionalPhones ?? rec.additionalPhoneNumbers;
    if (Array.isArray(extra)) extra.forEach(pushPhone);
    return out;
  }
  pushPhone(value);
  return out;
}

/** Friendly labels for Twenty's `FieldActorSource` enum values. */
export const ACTOR_SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  IMPORT: 'Import',
  API: 'API',
  WORKFLOW: 'Workflow',
  SYSTEM: 'System',
  EMAIL: 'Email',
  CALENDAR: 'Calendar',
  AGENT: 'Agent',
  WEBHOOK: 'Webhook',
  APPLICATION: 'Application',
};

/**
 * Resolve an ACTOR value into `{ name, source }`. Tolerates Twenty's
 * `{ source, workspaceMemberId, name }` composite, an object carrying just a
 * `name`, or a plain string (the actor name with no source tag).
 */
export function parseActor(value: unknown): { name: string; source: string } | null {
  if (typeof value === 'string') {
    const s = value.trim();
    return s ? { name: s, source: '' } : null;
  }
  const rec = asRecord(value);
  if (!rec) return null;
  const name = firstString(rec.name, rec.displayName, rec.label);
  const rawSource = firstString(rec.source);
  const source = rawSource
    ? ACTOR_SOURCE_LABELS[rawSource.toUpperCase()] ?? rawSource
    : '';
  if (!name && !source) return null;
  return { name, source };
}

/** Resolve the avatar image for an ACTOR value (workspace-member picture). */
export function actorAvatar(value: unknown): string | undefined {
  const rec = asRecord(value);
  if (!rec) return undefined;
  return (
    firstString(rec.avatarUrl, rec.avatar, rec.picture, rec.workspaceMemberAvatarUrl) ||
    undefined
  );
}

/**
 * Resolve a RICH_TEXT_V2 value into plain display text. Tolerates Twenty's
 * `{ blocknote, markdown }` composite (prefers `markdown`), and a plain string.
 */
export function parseRichText(value: unknown): string {
  const rec = asRecord(value);
  if (rec) return firstString(rec.markdown, rec.blocknote, rec.text);
  return typeof value === 'string' ? value : '';
}

/** Normalise a FULL_NAME value into `{ first, last }`. */
export function parseFullNameParts(value: unknown): { first: string; last: string } {
  const rec = asRecord(value);
  if (rec) {
    return {
      first: firstString(rec.firstName, rec.first),
      last: firstString(rec.lastName, rec.last),
    };
  }
  const s = String(value ?? '').trim();
  if (!s) return { first: '', last: '' };
  const idx = s.indexOf(' ');
  return idx < 0
    ? { first: s, last: '' }
    : { first: s.slice(0, idx), last: s.slice(idx + 1) };
}

/** Normalise a FULL_NAME value into "First Last". */
export function parseFullName(value: unknown): string {
  const { first, last } = parseFullNameParts(value);
  return [first, last].filter(Boolean).join(' ');
}

/** The editable parts of an ADDRESS value. */
export interface AddressParts {
  street: string;
  street2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

/** Normalise an ADDRESS value into its editable parts. */
export function parseAddressParts(value: unknown): AddressParts {
  const rec = asRecord(value);
  if (!rec) {
    return {
      street: value ? String(value) : '',
      street2: '',
      city: '',
      state: '',
      postcode: '',
      country: '',
    };
  }
  return {
    street: firstString(rec.street, rec.addressStreet1),
    street2: firstString(rec.street2, rec.addressStreet2),
    city: firstString(rec.city, rec.addressCity),
    state: firstString(rec.state, rec.addressState),
    postcode: firstString(rec.postcode, rec.addressPostcode, rec.zip),
    country: firstString(rec.country, rec.addressCountry),
  };
}

/** Normalise an ADDRESS value into ordered display lines. */
export function parseAddress(value: unknown): string[] {
  const p = parseAddressParts(value);
  const cityLine = [p.city, p.state, p.postcode].filter(Boolean).join(', ');
  return [p.street, p.street2, cityLine, p.country].filter(Boolean);
}

/**
 * Extract `{ url, name }` from a FILE / IMAGE / AVATAR value. Tolerates a bare
 * url string or a `{ url, name }` descriptor (Twenty's attachment shape).
 */
export function parseFileValue(value: unknown): { url: string; name: string } {
  const rec = asRecord(value);
  if (rec) {
    return {
      url: firstString(rec.url, rec.fullPath, rec.path, rec.src, rec.href),
      name: firstString(rec.name, rec.fileName, rec.label),
    };
  }
  return { url: typeof value === 'string' ? value : String(value ?? ''), name: '' };
}

/** Heuristic: does this URL / field look like a renderable image? */
export function looksLikeImage(url: string, field: FieldMetadata): boolean {
  const key = field.key.toLowerCase();
  if (
    key.includes('avatar') ||
    key.includes('logo') ||
    key.includes('photo') ||
    key.includes('image') ||
    key.includes('picture')
  ) {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?|#|$)/i.test(url);
}

/* =========================================================================
   Relation helpers (ported, resolver-injected instead of context-driven)
   ========================================================================= */

/** True when a string is (or looks like) a bare Mongo ObjectId. */
export function looksLikeId(s: string, id: string): boolean {
  return !s || s === id || /^[a-f0-9]{24}$/i.test(s);
}

/** Extract the record id from a relation value (bare id string or hint object). */
export function relationId(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  const rec = asRecord(value);
  if (rec) return firstString(rec.id, rec._id, rec.recordId);
  return '';
}

/** Pull a human label out of a relation value (id, {label}, {name}…). */
export function relationValueLabel(field: FieldMetadata, value: unknown): string {
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const labelField = field.relation?.labelField;
    const candidate =
      (labelField && rec[labelField]) ?? rec.label ?? rec.name ?? rec.title;
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (typeof candidate === 'number') return String(candidate);
  }
  return String(value);
}

/** Strip protocol / www / trailing slash so a domain reads as a bare host. */
function sanitizeDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .replace(/\/$/, '');
}

/** Company logo from a domain (Twenty's twenty-icons.com convention). */
export function logoUrlFromDomain(value: unknown): string | undefined {
  let raw = '';
  if (typeof value === 'string') {
    raw = value;
  } else {
    const rec = asRecord(value);
    if (rec) raw = firstString(rec.primaryLinkUrl, rec.url, rec.domainName, rec.href);
  }
  const host = sanitizeDomain(raw);
  return host ? `https://twenty-icons.com/${host}` : undefined;
}

/** A resolved avatar: an optional image URL + the shape to draw it in. */
export interface AvatarInfo {
  src?: string;
  shape: 'square' | 'round';
}

/**
 * Resolve the avatar/logo for a RELATION value. Companies (relations carrying
 * a `domainName`) get a favicon; people (carrying `avatarUrl`) get their
 * picture, round; everything else falls back to initials in a square.
 */
export function relationAvatar(field: FieldMetadata, value: unknown): AvatarInfo {
  const rec = asRecord(value);
  if (!rec) return { shape: 'square' };

  const avatarUrl = firstString(rec.avatarUrl, rec.avatar, rec.picture, rec.photoUrl);
  if (avatarUrl) return { src: avatarUrl, shape: 'round' };

  const logo = logoUrlFromDomain(rec.domainName ?? rec.domain ?? rec.website ?? undefined);
  if (logo) return { src: logo, shape: 'square' };

  const target = field.relation?.targetObject?.toLowerCase() ?? '';
  if (target === 'people' || target === 'workspacemembers' || target === 'workspacemember') {
    return { shape: 'round' };
  }
  return { shape: 'square' };
}

/**
 * Resolve a relation value to a display `{ label, src, shape }`, preferring
 * the injected resolver's label over the raw/enriched value — and never
 * showing a bare Mongo id when a name is known.
 */
export function resolveRelationDisplay(
  field: FieldMetadata,
  value: unknown,
  resolver?: RelationResolver,
): { label: string; src?: string; shape: 'square' | 'round' } {
  const id = relationId(value);
  const resolved = resolver?.label(field, value) ?? null;
  const base = relationValueLabel(field, value);
  const label = resolved ?? (looksLikeId(base, id) ? id || base : base);
  const { src, shape } = relationAvatar(field, value);
  return { label, src, shape };
}

/* =========================================================================
   Shared UI bits
   ========================================================================= */

/** The muted placeholder shown for null / empty values. */
export function EmptyValue(): React.JSX.Element {
  return (
    <span className="rc-empty" aria-label="Empty">
      —
    </span>
  );
}

/**
 * Keydown handler for single-line editors: Enter commits, Escape cancels.
 * Multiline editors should use {@link multilineKeyHandler} instead.
 */
export function editorKeyHandler(
  commit: () => void,
  cancel: () => void,
): (e: React.KeyboardEvent) => void {
  return (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  };
}

/** Keydown handler for textareas: Cmd/Ctrl+Enter commits, Escape cancels. */
export function multilineKeyHandler(
  commit: () => void,
  cancel: () => void,
): (e: React.KeyboardEvent) => void {
  return (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  };
}

/**
 * Container blur-commit: fires `commit` when focus leaves the wrapper
 * entirely (not when it moves between inner controls). Editors whose popovers
 * portal outside the wrapper should NOT use this — they commit on pick.
 */
export function useBlurCommit(
  commit: () => void,
): (e: React.FocusEvent<HTMLElement>) => void {
  return React.useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !e.currentTarget.contains(next)) commit();
    },
    [commit],
  );
}

/** Focus the first focusable element inside the ref'd container on mount. */
export function useAutoFocus<T extends HTMLElement>(): React.RefObject<T | null> {
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(
      'input, textarea, button, [tabindex]:not([tabindex="-1"])',
    );
    el?.focus();
  }, []);
  return ref;
}
