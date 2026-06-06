'use client';

/**
 * SabCRM — field renderer.
 *
 * The single, metadata-driven renderer for every {@link FieldType}. Two
 * modes:
 *
 *   - read  (`<FieldValue>`)  — a compact, display-only rendering used by
 *                              the record table and the detail panel.
 *   - edit  (`<FieldInput>`)  — a controlled input used by the create /
 *                              edit dialog.
 *
 * Both are driven entirely off a {@link FieldMetadata} document, so adding
 * a custom field never requires touching this file.
 *
 * File fields route through SabFiles (`SabFileUrlInput`) per SabNode
 * policy — there is no free-text URL paste anywhere in this module.
 *
 * A11y guarantees:
 *   - Every editable input is associated with a visible label via `id`
 *     (the host form supplies a `<label htmlFor={id}>`) or an explicit
 *     `aria-label` when the field label cannot be a `<label>` element.
 *   - Validation errors are referenced through `aria-describedby` pointing
 *     at a sibling error element managed by the host (`errorId` prop).
 *   - The BOOLEAN group and MULTI_SELECT group carry `role="group"` +
 *     `aria-labelledby` so assistive technology announces the field name.
 *   - The RATING widget uses `role="radiogroup"` / `role="radio"`.
 *   - The RELATION picker supports full keyboard navigation (arrows, Enter,
 *     Home/End, Escape) via the RelationInput component.
 */

import * as React from 'react';
import {
  Check,
  ExternalLink,
  Link as LinkIcon,
  Mail,
  Minus,
  Paperclip,
  Phone,
  Star,
} from 'lucide-react';

import {
  Badge,
  Input,
  Switch,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn,
} from '@/components/sabcrm/20ui/compat';
import { SabFileUrlInput } from '@/components/sabfiles';
import type {
  FieldMetadata,
  FieldOption,
  CrmRecordWithLabel,
} from '@/lib/sabcrm/types';
import {
  RelationInput,
  RelationValue,
  type RelationOption,
} from './relation-input';
import { useSabcrmSettings } from '@/components/sabcrm/twenty/sabcrm-settings-context';

// Re-export so existing call sites (e.g. record-form-dialog) keep importing
// the RELATION option type from the field renderer barrel.
export type { RelationOption };

// ---------------------------------------------------------------------------
// Value coercion helpers (records store free-form `unknown` values)
// ---------------------------------------------------------------------------

function asString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function asNumber(value: unknown): number | '' {
  if (value === '' || value == null) return '';
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : '';
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean);
  if (typeof value === 'string' && value) return [value];
  return [];
}

function optionFor(
  field: FieldMetadata,
  value: string,
): FieldOption | undefined {
  return field.options?.find((o) => o.value === value);
}

/**
 * Maps an option color (a `--zoru-*` token name or a hex value) onto a
 * style object. Hex values are applied inline; token names are passed
 * through as a CSS custom-property reference so the palette stays the
 * single source of truth.
 */
function colorStyle(color?: string): React.CSSProperties | undefined {
  if (!color) return undefined;
  if (color.startsWith('#')) {
    return { backgroundColor: `${color}1a`, color, borderColor: `${color}55` };
  }
  return {
    backgroundColor: `var(--zoru-${color}-soft, var(--zoru-surface))`,
    color: `var(--zoru-${color}, var(--zoru-ink))`,
  };
}

function formatNumber(value: unknown): string {
  const n = asNumber(value);
  if (n === '') return '';
  return new Intl.NumberFormat().format(n);
}

function formatCurrency(value: unknown): string {
  const n = asNumber(value);
  if (n === '') return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

function formatDate(value: unknown, withTime: boolean): string {
  const raw = asString(value);
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return withTime ? d.toLocaleString() : d.toLocaleDateString();
}

/** Maps a SabFiles `accept` category off a file field's metadata. */
function fileAccept(): 'all' {
  return 'all';
}

// ---------------------------------------------------------------------------
// Read-only display
// ---------------------------------------------------------------------------

export interface FieldValueProps {
  field: FieldMetadata;
  value: unknown;
  /**
   * Resolver for RELATION fields: maps a related record id to its display
   * label. Supplied by the table / detail host which has already fetched
   * the related records.
   */
  resolveRelationLabel?: (id: string) => string | undefined;
  /**
   * Resolver for RELATION fields: maps a related record id to a detail-route
   * href so each chip links through to the related record. Optional — chips
   * render as plain badges when omitted.
   */
  resolveRelationHref?: (id: string) => string | undefined;
  /** Compact single-line rendering for dense table cells. */
  dense?: boolean;
  className?: string;
}

/** Read-only display of a single field value. */
export const FieldValue = React.memo(function FieldValue({
  field,
  value,
  resolveRelationLabel,
  resolveRelationHref,
  dense = false,
  className,
}: FieldValueProps): React.ReactElement {
  const { fmt } = useSabcrmSettings();

  const empty = (
    <span className="text-[var(--st-text-secondary)]/60" aria-label="Empty">
      <Minus className="h-3.5 w-3.5" />
    </span>
  );

  switch (field.type) {
    case 'TEXT':
    case 'NUMBER':
    case 'CURRENCY': {
      let text: string;
      if (field.type === 'CURRENCY') {
        const n = asNumber(value);
        text = n === '' ? '' : fmt.currency(n);
      } else if (field.type === 'NUMBER') {
        const n = asNumber(value);
        text = n === '' ? '' : fmt.number(n);
      } else {
        text = asString(value);
      }
      if (!text) return empty;
      return (
        <span className={cn('text-[var(--st-text)]', dense && 'truncate', className)}>
          {text}
        </span>
      );
    }

    case 'BOOLEAN': {
      const on = asBoolean(value);
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-sm',
            on ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]',
            className,
          )}
        >
          {on ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          {!dense && (on ? 'Yes' : 'No')}
        </span>
      );
    }

    case 'DATE':
    case 'DATE_TIME': {
      const text =
        field.type === 'DATE_TIME' ? fmt.dateTime(value) : fmt.date(value);
      if (!text) return empty;
      return (
        <span className={cn('tabular-nums text-[var(--st-text)]', className)}>{text}</span>
      );
    }

    case 'EMAIL': {
      const text = asString(value);
      if (!text) return empty;
      return (
        <a
          href={`mailto:${text}`}
          className={cn(
            'inline-flex items-center gap-1 text-[var(--st-text)] hover:underline',
            dense && 'truncate',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]" />
          {text}
        </a>
      );
    }

    case 'PHONE': {
      const text = asString(value);
      if (!text) return empty;
      return (
        <a
          href={`tel:${text}`}
          className={cn(
            'inline-flex items-center gap-1 text-[var(--st-text)] hover:underline',
            dense && 'truncate',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]" />
          {text}
        </a>
      );
    }

    case 'LINK': {
      const text = asString(value);
      if (!text) return empty;
      const href = /^https?:\/\//i.test(text) ? text : `https://${text}`;
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center gap-1 text-[var(--st-text)] hover:underline',
            dense && 'truncate',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <LinkIcon className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]" />
          {text}
          <ExternalLink className="h-3 w-3 shrink-0 text-[var(--st-text-secondary)]" />
        </a>
      );
    }

    case 'SELECT': {
      const v = asString(value);
      if (!v) return empty;
      const opt = optionFor(field, v);
      return (
        <Badge
          variant="outline"
          className={cn('font-medium', className)}
          style={colorStyle(opt?.color)}
        >
          {opt?.label ?? v}
        </Badge>
      );
    }

    case 'MULTI_SELECT': {
      const vals = asStringArray(value);
      if (vals.length === 0) return empty;
      return (
        <span className={cn('flex flex-wrap gap-1', className)}>
          {vals.map((v) => {
            const opt = optionFor(field, v);
            return (
              <Badge
                key={v}
                variant="outline"
                className="font-medium"
                style={colorStyle(opt?.color)}
              >
                {opt?.label ?? v}
              </Badge>
            );
          })}
        </span>
      );
    }

    case 'RATING': {
      const n = asNumber(value);
      if (n === '') return empty;
      const filled = Math.max(0, Math.min(5, Math.round(n)));
      return (
        <span
          className={cn('inline-flex items-center gap-0.5', className)}
          aria-label={`${filled} out of 5`}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                'h-3.5 w-3.5',
                i < filled
                  ? 'fill-[var(--st-text)] text-[var(--st-text)]'
                  : 'text-[var(--st-text-secondary)]/40',
              )}
            />
          ))}
        </span>
      );
    }

    case 'RELATION':
      return (
        <RelationValue
          field={field}
          value={value}
          resolveRelationLabel={resolveRelationLabel}
          resolveRelationHref={resolveRelationHref}
          dense={dense}
          className={className}
        />
      );

    case 'FILE': {
      const url = asString(value);
      if (!url) return empty;
      const name = fileNameFromUrl(url);
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center gap-1 text-[var(--st-text)] hover:underline',
            dense && 'truncate',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]" />
          {name}
        </a>
      );
    }

    default:
      return empty;
  }
});
FieldValue.displayName = 'FieldValue';

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url, 'http://x').pathname;
    const last = path.split('/').filter(Boolean).pop() ?? url;
    return decodeURIComponent(last).replace(/^[0-9a-f]{16,}-/i, '') || url;
  } catch {
    return url;
  }
}

/**
 * Resolves the value shown as a record's display title. Falls back to the
 * server-resolved `label`, then to the first label/text field, then to the
 * record id.
 */
export function resolveRecordTitle(
  record: CrmRecordWithLabel,
  fields: FieldMetadata[],
): string {
  if (record.label) return record.label;
  const labelField = fields.find((f) => f.isLabel);
  if (labelField) {
    const v = asString(record.data[labelField.key]);
    if (v) return v;
  }
  const firstText = fields.find((f) => f.type === 'TEXT');
  if (firstText) {
    const v = asString(record.data[firstText.key]);
    if (v) return v;
  }
  return record._id;
}

// ---------------------------------------------------------------------------
// Sub-components for MULTI_SELECT and RATING inputs — extracted so that
// React.memo and useCallback can be used properly (hooks cannot appear inside
// a switch-case branch).
// ---------------------------------------------------------------------------

interface MultiSelectInputProps {
  field: FieldMetadata;
  value: unknown;
  onChange: (value: unknown) => void;
  invalid: boolean;
  disabled: boolean;
  errorId: string | undefined;
  className?: string;
}

const MultiSelectInput = React.memo(function MultiSelectInput({
  field,
  value,
  onChange,
  invalid,
  disabled,
  errorId,
  className,
}: MultiSelectInputProps): React.ReactElement {
  const selected = React.useMemo(() => asStringArray(value), [value]);

  const toggle = React.useCallback(
    (optValue: string) => {
      const next = selected.includes(optValue)
        ? selected.filter((s) => s !== optValue)
        : [...selected, optValue];
      onChange(next);
    },
    [selected, onChange],
  );

  const groupId = React.useId();

  return (
    <div
      role="group"
      aria-labelledby={`${groupId}-label`}
      aria-describedby={errorId}
      className={cn(
        'flex flex-wrap gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2',
        invalid && 'border-[var(--st-danger)]',
        disabled && 'opacity-60',
        className,
      )}
    >
      {/* Visually hidden label anchor for aria-labelledby */}
      <span id={`${groupId}-label`} className="sr-only">
        {field.label}
      </span>

      {(field.options ?? []).map((opt) => {
        const on = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            aria-label={`${opt.label}${on ? ', selected' : ''}`}
            onClick={() => toggle(opt.value)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              on
                ? 'border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-text-inverted)]'
                : 'border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)] hover:border-[var(--st-text)]/30 hover:text-[var(--st-text)]',
            )}
          >
            {on && <Check className="h-3 w-3" aria-hidden="true" />}
            {opt.label}
          </button>
        );
      })}
      {(field.options ?? []).length === 0 && (
        <span className="text-xs text-[var(--st-text-secondary)]">
          No options configured.
        </span>
      )}
    </div>
  );
});
MultiSelectInput.displayName = 'MultiSelectInput';

interface RatingInputProps {
  field: FieldMetadata;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
  errorId: string | undefined;
  className?: string;
}

const RatingInput = React.memo(function RatingInput({
  field,
  value,
  onChange,
  disabled,
  errorId,
  className,
}: RatingInputProps): React.ReactElement {
  const n = asNumber(value);
  const current = n === '' ? 0 : Math.max(0, Math.min(5, Math.round(n)));

  const handleClick = React.useCallback(
    (star: number) => {
      onChange(current === star ? '' : star);
    },
    [current, onChange],
  );

  return (
    <div
      role="radiogroup"
      aria-label={field.label}
      aria-describedby={errorId}
      className={cn('inline-flex items-center gap-1', className)}
    >
      {([1, 2, 3, 4, 5] as const).map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          aria-checked={current === star}
          role="radio"
          onClick={() => handleClick(star)}
          className="rounded p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed"
        >
          <Star
            aria-hidden="true"
            className={cn(
              'h-5 w-5',
              star <= current
                ? 'fill-[var(--st-text)] text-[var(--st-text)]'
                : 'text-[var(--st-text-secondary)]/40',
            )}
          />
        </button>
      ))}
    </div>
  );
});
RatingInput.displayName = 'RatingInput';

// ---------------------------------------------------------------------------
// Editable input
// ---------------------------------------------------------------------------

export interface FieldInputProps {
  field: FieldMetadata;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Marks the field invalid (e.g. required + empty after a submit attempt). */
  invalid?: boolean;
  disabled?: boolean;
  /** Candidate records for RELATION fields (host-supplied). */
  relationOptions?: RelationOption[];
  id?: string;
  /**
   * The `id` of a sibling element that describes validation errors. When
   * supplied it is forwarded to the underlying control as `aria-describedby`
   * so screen readers announce the error message automatically.
   */
  errorId?: string;
  className?: string;
}

/** Controlled editor for a single field, switching on its {@link FieldType}. */
export const FieldInput = React.memo(function FieldInput({
  field,
  value,
  onChange,
  invalid = false,
  disabled = false,
  relationOptions = [],
  id,
  errorId,
  className,
}: FieldInputProps): React.ReactElement {
  const invalidRing = invalid
    ? 'border-[var(--st-danger)] focus-visible:ring-[var(--st-danger)]/30'
    : undefined;
  // Forwarded to every underlying control so assistive technology reads the
  // validation message element when the field is in an error state.
  const describedBy = errorId ?? undefined;

  switch (field.type) {
    case 'TEXT': {
      // Long-form text uses a textarea; everything else a single-line input.
      const isLong = field.key.toLowerCase().includes('note') ||
        field.key.toLowerCase().includes('description') ||
        field.key.toLowerCase().includes('body');
      if (isLong) {
        return (
          <Textarea
            id={id}
            aria-label={id ? undefined : field.label}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={asString(value)}
            disabled={disabled}
            placeholder={field.description ?? `Enter ${field.label.toLowerCase()}`}
            onChange={(e) => onChange(e.target.value)}
            className={cn(invalidRing, className)}
            rows={3}
          />
        );
      }
      return (
        <Input
          id={id}
          aria-label={id ? undefined : field.label}
          aria-describedby={describedBy}
          value={asString(value)}
          disabled={disabled}
          placeholder={field.description ?? `Enter ${field.label.toLowerCase()}`}
          onChange={(e) => onChange(e.target.value)}
          className={cn(invalidRing, className)}
        />
      );
    }

    case 'NUMBER':
    case 'CURRENCY': {
      const n = asNumber(value);
      return (
        <Input
          id={id}
          aria-label={id ? undefined : field.label}
          aria-describedby={describedBy}
          type="number"
          inputMode="decimal"
          value={n === '' ? '' : String(n)}
          disabled={disabled}
          placeholder={field.type === 'CURRENCY' ? '0.00' : '0'}
          leadingSlot={field.type === 'CURRENCY' ? <span aria-hidden="true">$</span> : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === '' ? '' : Number(raw));
          }}
          className={cn(invalidRing, className)}
        />
      );
    }

    case 'EMAIL':
      return (
        <Input
          id={id}
          aria-label={id ? undefined : field.label}
          aria-describedby={describedBy}
          type="email"
          value={asString(value)}
          disabled={disabled}
          placeholder="name@example.com"
          leadingSlot={<Mail aria-hidden="true" />}
          onChange={(e) => onChange(e.target.value)}
          className={cn(invalidRing, className)}
        />
      );

    case 'PHONE':
      return (
        <Input
          id={id}
          aria-label={id ? undefined : field.label}
          aria-describedby={describedBy}
          type="tel"
          value={asString(value)}
          disabled={disabled}
          placeholder="+1 555 000 0000"
          leadingSlot={<Phone aria-hidden="true" />}
          onChange={(e) => onChange(e.target.value)}
          className={cn(invalidRing, className)}
        />
      );

    case 'LINK':
      return (
        <Input
          id={id}
          aria-label={id ? undefined : field.label}
          aria-describedby={describedBy}
          type="url"
          value={asString(value)}
          disabled={disabled}
          placeholder="https://example.com"
          leadingSlot={<LinkIcon aria-hidden="true" />}
          onChange={(e) => onChange(e.target.value)}
          className={cn(invalidRing, className)}
        />
      );

    case 'DATE':
      return (
        <Input
          id={id}
          aria-label={id ? undefined : field.label}
          aria-describedby={describedBy}
          type="date"
          value={asString(value).slice(0, 10)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(invalidRing, className)}
        />
      );

    case 'DATE_TIME':
      return (
        <Input
          id={id}
          aria-label={id ? undefined : field.label}
          aria-describedby={describedBy}
          type="datetime-local"
          value={toDateTimeLocal(asString(value))}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(invalidRing, className)}
        />
      );

    case 'BOOLEAN': {
      // The Switch receives `id` so a host <label htmlFor={id}> works.
      // The wrapping div uses role="group" + aria-label as a fallback when
      // no external label element is wired up.
      const boolLabel = asBoolean(value) ? 'Yes' : 'No';
      const boolLabelId = id ? `${id}-label` : undefined;
      return (
        <div
          role="group"
          aria-labelledby={boolLabelId}
          aria-describedby={describedBy}
          className={cn('flex items-center gap-2', className)}
        >
          <Switch
            id={id}
            aria-label={id ? undefined : field.label}
            checked={asBoolean(value)}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <span
            id={boolLabelId}
            className="text-sm text-[var(--st-text-secondary)]"
            aria-hidden="true"
          >
            {boolLabel}
          </span>
        </div>
      );
    }

    case 'SELECT': {
      const v = asString(value);
      return (
        <Select
          value={v || undefined}
          disabled={disabled}
          onValueChange={(next) => onChange(next)}
        >
          <SelectTrigger
            id={id}
            aria-label={id ? undefined : field.label}
            aria-describedby={describedBy}
            className={cn(invalidRing, className)}
          >
            <SelectValue
              placeholder={`Select ${field.label.toLowerCase()}`}
            />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case 'MULTI_SELECT':
      return (
        <MultiSelectInput
          field={field}
          value={value}
          onChange={onChange}
          invalid={invalid}
          disabled={disabled}
          errorId={describedBy}
          className={className}
        />
      );

    case 'RATING':
      return (
        <RatingInput
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
          errorId={describedBy}
          className={className}
        />
      );

    case 'RELATION':
      return (
        <RelationInput
          id={id}
          field={field}
          value={value}
          options={relationOptions}
          invalid={invalid}
          disabled={disabled}
          errorId={describedBy}
          className={className}
          onChange={(next) => onChange(next)}
        />
      );

    case 'FILE':
      // SabFileUrlInput does not accept arbitrary ARIA props; wrap it in a
      // labelled group so the field label and any error description are
      // still announced by assistive technology.
      return (
        <div
          role="group"
          aria-label={field.label}
          aria-describedby={describedBy}
          className={cn('contents', className)}
        >
          <SabFileUrlInput
            value={asString(value)}
            accept={fileAccept()}
            disabled={disabled}
            pickerTitle={`Attach ${field.label}`}
            onChange={(url) => onChange(url)}
          />
        </div>
      );

    default:
      return (
        <Input
          id={id}
          aria-label={id ? undefined : field.label}
          aria-describedby={describedBy}
          value={asString(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );
  }
});
FieldInput.displayName = 'FieldInput';

/** Normalises an ISO / arbitrary date string into `datetime-local` format. */
function toDateTimeLocal(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    // Already in `YYYY-MM-DDTHH:mm` shape — pass through trimmed.
    return raw.slice(0, 16);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
