'use client';

/**
 * SabCRM — Twenty-faithful FIELD VALUE renderer.
 *
 * `<TwentyFieldValue field value />` is a *pure display* component: given a
 * {@link FieldMetadata} and a raw stored value it renders the value the way
 * upstream Twenty does — currency money-formatted, links as anchors, emails /
 * phones clickable, ratings as star glyphs, dates humanized, booleans as a
 * check / dash, SELECT options as colored chips, relations as chips, ACTOR as
 * an avatar + name + muted source tag, RICH_TEXT_V2 as a clamped markdown
 * preview, and plain text for everything else. NUMERIC aliases NUMBER. Null /
 * empty values collapse to a muted em-dash.
 *
 * It is intentionally dependency-light (no date lib — `toLocaleDateString`),
 * stateless and side-effect-free. The two record screens use it for the *read*
 * (display) state of a cell / field row; their click-to-edit behaviour is
 * unaffected because this component only paints the resting value.
 *
 * NO ZoruUI / Tailwind / clay here — Twenty look only (`.st-field*` classes in
 * the sibling `twenty-field.css`, plus the shared `TwentyChip`).
 */

import * as React from 'react';

import { TwentyAvatar, TwentyChip } from './twenty-primitives';
import { useResolveActorName, type ResolveActorName } from './sabcrm-actors-context';
import type { FieldMetadata, FieldOption } from '@/lib/sabcrm/types';

import './twenty-field.css';
import './field-types.css';

/* =========================================================================
   Value helpers
   ========================================================================= */

/** The muted placeholder shown for null / empty values. */
function EmptyValue(): React.JSX.Element {
  return <span className="st-field-empty">—</span>;
}

/** Treat null / undefined / empty-string as "no value". */
function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Resolve a SELECT / MULTI_SELECT option color token into an inline CSS color.
 * `--zoru-*` tokens become `var(--zoru-*)`; hex / rgb pass through; otherwise
 * `undefined` (the chip then renders without a dot).
 */
function chipColor(color?: string): string | undefined {
  if (!color) return undefined;
  if (color.startsWith('#') || color.startsWith('rgb')) return color;
  if (color.startsWith('--')) return `var(${color})`;
  return undefined;
}

/** Format a number with thousands separators, integers stay integer. */
function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Format a number as currency for `code` (defaults to USD), Intl-formatted. */
function formatCurrency(n: number, code = 'USD'): string {
  try {
    return n.toLocaleString(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    });
  } catch {
    // Unknown / non-ISO currency code → plain number with the code appended.
    return `${formatNumber(n)} ${code}`;
  }
}

/* =========================================================================
   Composite-value parsing
   ========================================================================= */

/** Narrow an unknown to a plain object record (or null). */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** First non-empty string among the candidates. */
function firstString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
    if (typeof c === 'number' && !Number.isNaN(c)) return String(c);
  }
  return '';
}

/**
 * Resolve a CURRENCY value into `{ amount, code }`. Tolerates Twenty's
 * `{ amountMicros, currencyCode }` (micros = amount × 1e6), the simpler
 * `{ amount, currencyCode }`, and a plain number fallback.
 */
function parseCurrency(value: unknown): { amount: number; code: string } | null {
  const rec = asRecord(value);
  if (rec) {
    const code = firstString(rec.currencyCode, rec.code) || 'USD';
    if (rec.amountMicros !== undefined && rec.amountMicros !== null) {
      const micros = Number(rec.amountMicros);
      if (!Number.isNaN(micros)) return { amount: micros / 1_000_000, code };
    }
    const amount = Number(rec.amount);
    if (!Number.isNaN(amount)) return { amount, code };
    return null;
  }
  const n = Number(value);
  return Number.isNaN(n) ? null : { amount: n, code: 'USD' };
}

/** A normalised `{ label, url }` link. */
interface NormLink {
  label: string;
  url: string;
}

/**
 * Normalise a LINKS value into a flat list of `{ label, url }`. Tolerates an
 * array of `{ label, url }`, an array of bare url strings, or Twenty's
 * `{ primaryLinkUrl, primaryLinkLabel, secondaryLinks }` composite.
 */
function parseLinks(value: unknown): NormLink[] {
  const out: NormLink[] = [];
  const push = (raw: unknown) => {
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
 * Normalise an EMAILS / PHONES value into a flat string list. Tolerates a
 * plain array, a single string, or Twenty's `{ primaryX, additionalX }`
 * composite.
 */
function parseStringList(value: unknown, primaryKey: string, listKey: string): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (asRecord(v) ? firstString((v as Record<string, unknown>).number, (v as Record<string, unknown>).email, (v as Record<string, unknown>).value) : String(v)))
      .filter((s) => s.trim());
  }
  const rec = asRecord(value);
  if (rec) {
    const out: string[] = [];
    const primary = firstString(rec[primaryKey]);
    if (primary) out.push(primary);
    const extra = rec[listKey];
    if (Array.isArray(extra)) {
      extra.forEach((v) => {
        const s = asRecord(v)
          ? firstString((v as Record<string, unknown>).number, (v as Record<string, unknown>).email, (v as Record<string, unknown>).value)
          : String(v);
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
 * Twenty's `{ primaryPhoneNumber, primaryPhoneCountryCode, primaryPhoneCallingCode,
 * additionalPhones[] }` composite, a plain array of strings / objects, or a
 * single string. The country / calling code is prefixed to the display + dial
 * so `tel:` links carry the full international number.
 */
function parsePhones(value: unknown): Array<{ display: string; dial: string }> {
  const out: Array<{ display: string; dial: string }> = [];
  const pushPhone = (raw: unknown) => {
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (s) out.push({ display: s, dial: s });
      return;
    }
    const rec = asRecord(raw);
    if (!rec) return;
    const number = firstString(
      rec.number,
      rec.primaryPhoneNumber,
      rec.phoneNumber,
      rec.value,
    );
    if (!number) return;
    // callingCode is the `+NN` dialling prefix; countryCode is the ISO region.
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
const ACTOR_SOURCE_LABELS: Record<string, string> = {
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
 * `{ source, workspaceMemberId, name }` composite (where `source` is a
 * `FieldActorSource` enum value), an object carrying just a `name`, or a plain
 * string (treated as the actor name with no source tag).
 */
function parseActor(value: unknown): { name: string; source: string } | null {
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

/**
 * Map an ACTOR value carrying a workspaceMember / user **id** (a bare id string,
 * or a composite's `workspaceMemberId` / an id stuffed into `name`) to one
 * carrying the resolved display NAME — so a "Created by" / "Updated by" cell
 * reads "Jane Doe" instead of a raw `6a15…` id. A no-op when the id can't be
 * resolved or the value already carries a real name, so display degrades to the
 * id rather than breaking.
 */
function withResolvedActor(value: unknown, resolve: ResolveActorName): unknown {
  // Bare id string (the common stored shape for system actor fields).
  if (typeof value === 'string') {
    const id = value.trim();
    const name = id ? resolve(id) : undefined;
    return name ? { source: 'MANUAL', name, workspaceMemberId: id } : value;
  }
  const rec = asRecord(value);
  if (!rec) return value;
  // Prefer an explicit member id; else treat a `name` that is really an id as
  // the lookup key. A `name` that's already a real label won't resolve, so it
  // is left untouched.
  const candidateId = firstString(rec.workspaceMemberId, rec.name).trim();
  if (!candidateId) return value;
  const name = resolve(candidateId);
  return name ? { ...rec, name } : value;
}

/**
 * Resolve a RICH_TEXT_V2 value into plain display text. Tolerates Twenty's
 * `{ blocknote, markdown }` composite (prefers `markdown`), and a plain string.
 */
function parseRichText(value: unknown): string {
  const rec = asRecord(value);
  if (rec) {
    return firstString(rec.markdown, rec.blocknote, rec.text);
  }
  return typeof value === 'string' ? value : '';
}

/** Normalise a FULL_NAME value into "First Last". */
function parseFullName(value: unknown): string {
  const rec = asRecord(value);
  if (rec) {
    return [firstString(rec.firstName, rec.first), firstString(rec.lastName, rec.last)]
      .filter(Boolean)
      .join(' ');
  }
  return String(value ?? '');
}

/** Normalise an ADDRESS value into ordered display lines. */
function parseAddress(value: unknown): string[] {
  const rec = asRecord(value);
  if (!rec) return value ? [String(value)] : [];
  const street = firstString(rec.street, rec.addressStreet1);
  const street2 = firstString(rec.addressStreet2);
  const city = firstString(rec.city, rec.addressCity);
  const state = firstString(rec.state, rec.addressState);
  const postcode = firstString(rec.postcode, rec.addressPostcode, rec.zip);
  const country = firstString(rec.country, rec.addressCountry);
  const cityLine = [city, state, postcode].filter(Boolean).join(', ');
  return [street, street2, cityLine, country].filter(Boolean);
}

/** Humanize a date — e.g. "Apr 3, 2026" (no external date lib). */
function formatDate(value: unknown, withTime: boolean): string | null {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  const base = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!withTime) return base;
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${base} · ${time}`;
}

/** Strip protocol / path so a link reads as a clean host (Twenty style). */
function linkLabel(url: string): string {
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname !== '/' ? u.pathname : ''}`;
  } catch {
    return url;
  }
}

/** Pull a human label out of a relation value (id, {label}, {name}…). */
function relationLabel(field: FieldMetadata, value: unknown): string {
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

/* =========================================================================
   Avatar / logo resolution (Twenty parity)

   Twenty paints a 14px square-rounded avatar next to companies (a favicon
   resolved from their domain), people (their `avatarUrl`), and on ACTOR /
   RELATION / workspaceMember chips. We mirror that here: every helper returns
   a `{ src?, shape }` we can hand straight to <TwentyAvatar>.
   ========================================================================= */

/** A resolved avatar: an optional image URL + the shape to draw it in. */
interface AvatarInfo {
  src?: string;
  shape: 'square' | 'round';
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

/**
 * Twenty resolves a company logo from its domain via `twenty-icons.com`
 * (same convention as the upstream `getLogoUrlFromDomainName` util). Accepts a
 * bare domain string, a full URL, or a LINKS composite (`primaryLinkUrl`).
 */
function logoUrlFromDomain(value: unknown): string | undefined {
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

/**
 * Resolve the avatar/logo for a RELATION value. Companies (relations carrying a
 * `domainName`) get a favicon; people (carrying `avatarUrl`) get their picture
 * with a round shape; everything else falls back to initials in a square.
 */
function relationAvatar(field: FieldMetadata, value: unknown): AvatarInfo {
  const rec = asRecord(value);
  if (!rec) return { shape: 'square' };

  const avatarUrl = firstString(rec.avatarUrl, rec.avatar, rec.picture, rec.photoUrl);
  if (avatarUrl) return { src: avatarUrl, shape: 'round' };

  const domain =
    rec.domainName ?? rec.domain ?? rec.website ?? undefined;
  const logo = logoUrlFromDomain(domain);
  if (logo) return { src: logo, shape: 'square' };

  // workspaceMember / generic person relations are circular even w/o an image.
  const target = field.relation?.targetObject?.toLowerCase() ?? '';
  if (target === 'people' || target === 'workspacemembers' || target === 'workspacemember') {
    return { shape: 'round' };
  }
  return { shape: 'square' };
}

/** Resolve the avatar image for an ACTOR value (workspace-member picture). */
function actorAvatar(value: unknown): string | undefined {
  const rec = asRecord(value);
  if (!rec) return undefined;
  return (
    firstString(rec.avatarUrl, rec.avatar, rec.picture, rec.workspaceMemberAvatarUrl) ||
    undefined
  );
}

/**
 * Extract `{ src, name }` from a FILE / IMAGE / AVATAR value. Tolerates a bare
 * url string or a `{ url, name }` descriptor (Twenty's attachment shape).
 */
function parseFileValue(value: unknown): { url: string; name: string } {
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
function looksLikeImage(url: string, field: FieldMetadata): boolean {
  const key = field.key.toLowerCase();
  if (key.includes('avatar') || key.includes('logo') || key.includes('photo') || key.includes('image') || key.includes('picture')) {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?|#|$)/i.test(url);
}

/* =========================================================================
   Rating
   ========================================================================= */

const RATING_MAX = 5;

function Rating({ value }: { value: number }): React.JSX.Element {
  const filled = Math.max(0, Math.min(RATING_MAX, Math.round(value)));
  return (
    <span className="st-field-rating" aria-label={`${filled} out of ${RATING_MAX}`}>
      {Array.from({ length: RATING_MAX }).map((_, i) => (
        <span
          key={i}
          className={`st-field-star${i < filled ? ' is-on' : ''}`}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

/* =========================================================================
   TwentyFieldValue
   ========================================================================= */

export interface TwentyFieldValueProps {
  field: FieldMetadata;
  value: unknown;
}

/**
 * Pure display renderer for a single field value, switching on `field.type`.
 * Preserves Twenty's read-state presentation for every supported field type.
 */
export function TwentyFieldValue({
  field,
  value,
}: TwentyFieldValueProps): React.JSX.Element {
  // Resolve ACTOR ids → member names (no-op outside the SabCRM layout's
  // SabcrmActorNameProvider, so this stays safe everywhere).
  const resolveActorName = useResolveActorName();
  // Some types legitimately carry an array / object that `isEmpty` ignores
  // (e.g. empty string), but most empty values collapse to an em-dash.
  const ARRAY_OR_OBJECT_TYPES: ReadonlySet<FieldMetadata['type']> = new Set([
    'MULTI_SELECT',
    'EMAILS',
    'PHONES',
    'LINKS',
    'ARRAY',
    'FULL_NAME',
    'ADDRESS',
    'RAW_JSON',
    'ACTOR',
    'RICH_TEXT_V2',
  ]);
  if (isEmpty(value) && field.type !== 'BOOLEAN') {
    const hasComposite =
      ARRAY_OR_OBJECT_TYPES.has(field.type) &&
      ((Array.isArray(value) && value.length > 0) || asRecord(value) !== null);
    if (!hasComposite) {
      return <EmptyValue />;
    }
  }

  // IMAGE / AVATAR are runtime field-type aliases (not in the FieldMetadata
  // union) that render a standalone avatar — an image with an initials
  // fallback, exactly like Twenty's <Avatar>. Branched before the switch so the
  // typed `field.type` switch below stays exhaustive + unchanged.
  const runtimeType = field.type as string;
  if (runtimeType === 'IMAGE' || runtimeType === 'AVATAR') {
    const { url, name } = parseFileValue(value);
    const display = name || field.label || 'Avatar';
    return (
      <TwentyAvatar
        name={display}
        src={url || undefined}
        size="sm"
        shape={runtimeType === 'AVATAR' ? 'round' : 'square'}
        className="st-field-avatar"
      />
    );
  }

  switch (field.type) {
    case 'CURRENCY': {
      const money = parseCurrency(value);
      if (!money) {
        return <span className="st-field-text">{String(value)}</span>;
      }
      return (
        <span className="st-field-money">
          {formatCurrency(money.amount, money.code)}
          <span className="st-field-money__code">{money.code}</span>
        </span>
      );
    }

    case 'NUMBER':
    case 'NUMERIC': {
      // NUMERIC is Twenty's high-precision numeric (string-backed); both render
      // as a thousands-separated number.
      const n = Number(value);
      return Number.isNaN(n) ? (
        <span className="st-field-text">{String(value)}</span>
      ) : (
        <span className="st-field-num">{formatNumber(n)}</span>
      );
    }

    case 'LINK': {
      const url = String(value);
      const href = url.includes('://') ? url : `https://${url}`;
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="st-field-link"
          title={url}
          onClick={(e) => e.stopPropagation()}
        >
          {linkLabel(url)}
        </a>
      );
    }

    case 'EMAIL':
      return (
        <a
          href={`mailto:${String(value)}`}
          className="st-field-link"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );

    case 'PHONE':
      return (
        <a
          href={`tel:${String(value)}`}
          className="st-field-link"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );

    case 'RATING': {
      const n = Number(value);
      return Number.isNaN(n) ? (
        <span className="st-field-text">{String(value)}</span>
      ) : (
        <Rating value={n} />
      );
    }

    case 'DATE': {
      const out = formatDate(value, false);
      return (
        <span className="st-field-date">{out ?? String(value)}</span>
      );
    }

    case 'DATE_TIME': {
      const out = formatDate(value, true);
      return (
        <span className="st-field-date">{out ?? String(value)}</span>
      );
    }

    case 'BOOLEAN': {
      const on = Boolean(value);
      return on ? (
        <span className="st-field-bool is-on" aria-label="Yes">
          ✓
        </span>
      ) : (
        <span className="st-field-bool" aria-label="No">
          —
        </span>
      );
    }

    case 'SELECT': {
      const opt: FieldOption | undefined = field.options?.find(
        (o) => o.value === value,
      );
      return (
        <TwentyChip
          label={opt?.label ?? String(value)}
          color={chipColor(opt?.color)}
        />
      );
    }

    case 'MULTI_SELECT': {
      const arr = Array.isArray(value) ? value : [value];
      return (
        <span className="st-field-chips">
          {arr.map((v) => {
            const opt = field.options?.find((o) => o.value === v);
            return (
              <TwentyChip
                key={String(v)}
                label={opt?.label ?? String(v)}
                color={chipColor(opt?.color)}
              />
            );
          })}
        </span>
      );
    }

    case 'RELATION': {
      // ONE_TO_MANY → array of related records; MANY_TO_ONE → single ref.
      // Each chip leads with the related entity's avatar/logo (company favicon
      // from its domain, or a person's avatarUrl) + an initials fallback, like
      // Twenty's RecordChip.
      const arr = Array.isArray(value) ? value : [value];
      return (
        <span className="st-field-chips">
          {arr.map((v, i) => {
            const label = relationLabel(field, v);
            const avatar = relationAvatar(field, v);
            return (
              <span key={`${label}-${i}`} className="st-chip st-chip--avatar">
                <TwentyAvatar
                  name={label}
                  src={avatar.src}
                  shape={avatar.shape}
                  size="xs"
                  className="st-chip__avatar"
                />
                <span className="st-chip__label">{label}</span>
              </span>
            );
          })}
        </span>
      );
    }

    case 'FILE': {
      // A FILE value may be a url or a { url, name } descriptor.
      const { url, name: rawName } = parseFileValue(value);
      if (!url) return <EmptyValue />;
      // Image-like files (avatarUrl, logos, *.png …) render as a small rounded
      // avatar with an initials fallback, mirroring Twenty's media cells.
      if (looksLikeImage(url, field)) {
        const display = rawName || field.label || 'Image';
        const round =
          field.key.toLowerCase().includes('avatar') ||
          field.key.toLowerCase().includes('photo') ||
          field.key.toLowerCase().includes('picture');
        return (
          <TwentyAvatar
            name={display}
            src={url}
            size="sm"
            shape={round ? 'round' : 'square'}
            className="st-field-avatar"
          />
        );
      }
      const name = rawName || linkLabel(url);
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="st-field-link"
          onClick={(e) => e.stopPropagation()}
        >
          {name}
        </a>
      );
    }

    case 'FULL_NAME': {
      const name = parseFullName(value).trim();
      return name ? (
        <span className="st-field-text">{name}</span>
      ) : (
        <EmptyValue />
      );
    }

    case 'ADDRESS': {
      const lines = parseAddress(value);
      if (lines.length === 0) return <EmptyValue />;
      return (
        <span className="st-field-stack">
          {lines.map((line, i) => (
            <span
              key={i}
              className={`st-field-stack__line${i > 0 ? ' st-field-stack__line--muted' : ''}`}
            >
              {line}
            </span>
          ))}
        </span>
      );
    }

    case 'EMAILS': {
      const emails = parseStringList(value, 'primaryEmail', 'additionalEmails');
      if (emails.length === 0) return <EmptyValue />;
      return (
        <span className="st-field-chips">
          {emails.map((email, i) => (
            <a
              key={`${email}-${i}`}
              href={`mailto:${email}`}
              className="st-chip st-chip--link"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="st-chip__label">{email}</span>
            </a>
          ))}
        </span>
      );
    }

    case 'PHONES': {
      const phones = parsePhones(value);
      if (phones.length === 0) return <EmptyValue />;
      return (
        <span className="st-field-chips">
          {phones.map((phone, i) => (
            <a
              key={`${phone.dial}-${i}`}
              href={`tel:${phone.dial}`}
              className="st-chip st-chip--link"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="st-chip__label">{phone.display}</span>
            </a>
          ))}
        </span>
      );
    }

    case 'LINKS': {
      const links = parseLinks(value).filter((l) => l.url || l.label);
      if (links.length === 0) return <EmptyValue />;
      return (
        <span className="st-field-chips">
          {links.map((link, i) => {
            const href = link.url
              ? link.url.includes('://')
                ? link.url
                : `https://${link.url}`
              : undefined;
            const text = link.label || (link.url ? linkLabel(link.url) : '');
            return href ? (
              <a
                key={`${href}-${i}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="st-chip st-chip--link"
                title={link.url}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="st-chip__label">{text}</span>
              </a>
            ) : (
              <TwentyChip key={`${text}-${i}`} label={text} />
            );
          })}
        </span>
      );
    }

    case 'ARRAY': {
      const arr = Array.isArray(value)
        ? value
        : String(value)
            .split(',')
            .map((s) => s.trim());
      const items = arr.map((v) => String(v)).filter((s) => s.length > 0);
      if (items.length === 0) return <EmptyValue />;
      return (
        <span className="st-field-chips">
          {items.map((item, i) => (
            <TwentyChip key={`${item}-${i}`} label={item} />
          ))}
        </span>
      );
    }

    case 'RAW_JSON': {
      let text: string;
      try {
        text =
          typeof value === 'string'
            ? JSON.stringify(JSON.parse(value), null, 2)
            : JSON.stringify(value, null, 2);
      } catch {
        text = String(value);
      }
      if (!text || text === 'null' || text === '{}' || text === '[]') {
        return <EmptyValue />;
      }
      return <pre className="st-field-json">{text}</pre>;
    }

    case 'ACTOR': {
      const resolved = withResolvedActor(value, resolveActorName);
      const actor = parseActor(resolved);
      if (!actor || (!actor.name && !actor.source)) return <EmptyValue />;
      const displayName = actor.name || actor.source || 'Unknown';
      const avatarSrc = actorAvatar(resolved);
      return (
        <span className="st-field-actor">
          <TwentyAvatar
            name={displayName}
            src={avatarSrc}
            shape="round"
            size="xs"
          />
          <span className="st-field-actor__name">{displayName}</span>
          {actor.source ? (
            <span className="st-field-actor__source">{actor.source}</span>
          ) : null}
        </span>
      );
    }

    case 'RICH_TEXT_V2': {
      const text = parseRichText(value).trim();
      return text ? (
        <span className="st-field-richtext">{text}</span>
      ) : (
        <EmptyValue />
      );
    }

    case 'TEXT':
    default:
      return <span className="st-field-text">{String(value)}</span>;
  }
}

export default TwentyFieldValue;
