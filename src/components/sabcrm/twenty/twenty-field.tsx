'use client';

/**
 * SabCRM — Twenty-faithful FIELD VALUE renderer.
 *
 * `<TwentyFieldValue field value />` is a *pure display* component: given a
 * {@link FieldMetadata} and a raw stored value it renders the value the way
 * upstream Twenty does — currency money-formatted, links as anchors, emails /
 * phones clickable, ratings as star glyphs, dates humanized, booleans as a
 * check / dash, SELECT options as colored chips, relations as chips and plain
 * text for everything else. Null / empty values collapse to a muted em-dash.
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

import { TwentyChip } from './twenty-primitives';
import type { FieldMetadata, FieldOption } from '@/lib/sabcrm/types';

import './twenty-field.css';

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

/** Format a number as USD currency (Twenty defaults to a money string). */
function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
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
  // MULTI_SELECT may legitimately carry an array; otherwise empty collapses.
  if (isEmpty(value) && field.type !== 'BOOLEAN') {
    if (!(field.type === 'MULTI_SELECT' && Array.isArray(value) && value.length)) {
      return <EmptyValue />;
    }
  }

  switch (field.type) {
    case 'CURRENCY': {
      const n = Number(value);
      return Number.isNaN(n) ? (
        <span className="st-field-text">{String(value)}</span>
      ) : (
        <span className="st-field-num">{formatCurrency(n)}</span>
      );
    }

    case 'NUMBER': {
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
      const arr = Array.isArray(value) ? value : [value];
      return (
        <span className="st-field-chips">
          {arr.map((v, i) => (
            <TwentyChip key={`${relationLabel(field, v)}-${i}`} label={relationLabel(field, v)} />
          ))}
        </span>
      );
    }

    case 'FILE': {
      // A FILE value may be a url or a { url, name } descriptor.
      const url =
        typeof value === 'object' && value
          ? String((value as Record<string, unknown>).url ?? '')
          : String(value);
      const name =
        typeof value === 'object' && value
          ? String((value as Record<string, unknown>).name ?? linkLabel(url))
          : linkLabel(url);
      if (!url) return <EmptyValue />;
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

    case 'TEXT':
    default:
      return <span className="st-field-text">{String(value)}</span>;
  }
}

export default TwentyFieldValue;
