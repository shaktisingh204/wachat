'use client';

/**
 * SabCRM — Twenty-faithful record FIELD PANEL.
 *
 * `<RecordFieldPanel object record onUpdate canEdit />` is the left-column field
 * list of Twenty's record-show page: every field of the object rendered as a
 * label→value row, the row leading with the field's icon, the value shown via
 * {@link TwentyFieldValue} in its resting (read) state and made click-to-edit
 * inline — mirroring Twenty's `RecordDetailRecordsList` / field-card layout
 * (`packages/twenty-front/src/modules/object-record/record-show`).
 *
 * Editing is now FULL Twenty-parity: every field type gets the right inline
 * editor, not just text. Clicking (or Enter on) a value swaps the read display
 * for the type-appropriate editor —
 *
 *   · TEXT / EMAIL / PHONE / LINK         → a single-line text input
 *   · NUMBER / NUMERIC                     → a numeric input
 *   · CURRENCY                             → an amount input + a currency-code box
 *   · DATE / DATE_TIME                     → a native date / datetime-local input
 *   · BOOLEAN                              → an inline toggle (click flips it)
 *   · SELECT                               → an option dropdown (colored chips)
 *   · MULTI_SELECT                         → a checklist popover of options
 *   · RATING                               → a 0–5 star picker
 *   · EMAILS / PHONES / LINKS / ARRAY      → an add/remove multi-value list
 *   · ADDRESS                              → a small multi-field address form
 *   · RELATION                             → read-only here (managed in the
 *                                            record-page Relations section)
 *
 * Each editor commits in the value SHAPE the {@link TwentyFieldValue} display
 * side reads back (and that `updateSabcrmRecordTw` accepts): scalar strings /
 * numbers, `{ amount, currencyCode }` for currency, ISO strings for dates,
 * string arrays for EMAILS/PHONES/MULTI_SELECT/ARRAY, `{ label, url }[]` for
 * LINKS, and a flat address object for ADDRESS. A commit fires
 * `onUpdate(field.key, value)` — the parent owns persistence through the gated
 * `updateSabcrmRecordTw` action (this component never touches the backend).
 *
 * System fields (`createdBy` / `createdAt` / `updatedAt` and any `field.system`)
 * are collected into a muted group pinned to the bottom of the panel, just like
 * Twenty groups its system metadata.
 *
 * NO Ui20 / Tailwind / clay — Twenty look only: the shared `.st-field-row*` /
 * `.st-cell-*` classes plus a co-located `.st-rfp-*` block in
 * `record-field-panel.css`. Relies on the `--st-*` tokens from
 * `sabcrm-twenty.css`.
 */

import * as React from 'react';
import {
  AtSign,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  CheckSquare,
  CircleUser,
  Clock,
  Contact,
  DollarSign,
  FileText,
  Globe,
  Hash,
  Image as ImageIcon,
  Link2,
  Link as LinkIcon,
  List,
  ListChecks,
  MapPin,
  Phone,
  Plus,
  Braces,
  Star,
  Tag,
  Target,
  Text,
  ToggleLeft,
  User,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

import { TwentyFieldValue } from './twenty-field';
import type {
  ObjectMetadata,
  FieldMetadata,
  FieldType,
} from '@/lib/sabcrm/types';
import type { SabcrmRustRecord } from '@/lib/rust-client/sabcrm-records';

import './record-field-panel.css';

/* =========================================================================
   Inline-editable type set (Twenty parity)

   Every field type below gets a type-appropriate inline editor. The only
   read-only type is RELATION — its attach/detach is owned by the record page's
   Relations section (changing a relation needs a record search picker, which is
   a page-level concern), and the rich-text / composite display-only types fall
   through to a read-only value (graceful, never blocks the row).
   ========================================================================= */

/** The field types this panel makes inline-editable. */
const INLINE_EDITABLE: ReadonlySet<FieldType> = new Set<FieldType>([
  'TEXT',
  'EMAIL',
  'PHONE',
  'LINK',
  'NUMBER',
  'NUMERIC',
  'CURRENCY',
  'RATING',
  'SELECT',
  'MULTI_SELECT',
  'BOOLEAN',
  'DATE',
  'DATE_TIME',
  'EMAILS',
  'PHONES',
  'LINKS',
  'ADDRESS',
  'ARRAY',
]);

/** Numeric scalar input types — rendered with a `number` input. */
const NUMERIC_INPUT: ReadonlySet<FieldType> = new Set<FieldType>([
  'NUMBER',
  'NUMERIC',
]);

/** The text-like scalar types that share the plain single-line text editor. */
const TEXTLIKE_INPUT: ReadonlySet<FieldType> = new Set<FieldType>([
  'TEXT',
  'EMAIL',
  'PHONE',
  'LINK',
]);

/* =========================================================================
   Field icon resolution

   Twenty paints a small icon to the left of every field label. Field metadata
   carries a kebab-case icon name (`map-pin`, `dollar-sign`, …); we map the
   common ones to a lucide glyph and otherwise fall back to a per-field-type
   default — so a field with no / unknown icon still leads with a meaningful
   glyph, like upstream.
   ========================================================================= */

/** Curated kebab-case → lucide glyph map for the names SabCRM schemas emit. */
const ICON_BY_NAME: Record<string, LucideIcon> = {
  'at-sign': AtSign,
  braces: Braces,
  'building-2': Building2,
  building: Building2,
  calendar: Calendar,
  'calendar-clock': CalendarClock,
  'check-square': CheckSquare,
  clock: Clock,
  contact: Contact,
  'dollar-sign': DollarSign,
  'file-text': FileText,
  globe: Globe,
  hash: Hash,
  image: ImageIcon,
  link: LinkIcon,
  'link-2': Link2,
  linkedin: Link2,
  list: List,
  'list-checks': ListChecks,
  mail: AtSign,
  'map-pin': MapPin,
  phone: Phone,
  star: Star,
  tag: Tag,
  target: Target,
  'target-arrow': Target,
  text: Text,
  'toggle-left': ToggleLeft,
  twitter: Link2,
  user: User,
  'user-check': UserCheck,
  'user-circle': CircleUser,
  users: Users,
};

/** Per-field-type default icon when a field carries no / unknown icon name. */
const ICON_BY_TYPE: Partial<Record<FieldType, LucideIcon>> = {
  TEXT: Text,
  NUMBER: Hash,
  NUMERIC: Hash,
  CURRENCY: DollarSign,
  RATING: Star,
  BOOLEAN: ToggleLeft,
  DATE: Calendar,
  DATE_TIME: CalendarClock,
  SELECT: Tag,
  MULTI_SELECT: ListChecks,
  RELATION: Link2,
  LINK: LinkIcon,
  LINKS: Link2,
  EMAIL: AtSign,
  EMAILS: AtSign,
  PHONE: Phone,
  PHONES: Phone,
  ADDRESS: MapPin,
  FULL_NAME: Contact,
  FILE: FileText,
  ARRAY: List,
  RAW_JSON: Braces,
  ACTOR: CircleUser,
  RICH_TEXT_V2: FileText,
};

/** Resolve the lucide glyph for a field: explicit name → type default → Text. */
function iconForField(field: FieldMetadata): LucideIcon {
  if (field.icon) {
    const byName = ICON_BY_NAME[field.icon.toLowerCase()];
    if (byName) return byName;
  }
  return ICON_BY_TYPE[field.type] ?? Text;
}

/* =========================================================================
   Value coercion / parsing helpers

   Editors read the stored value into their draft state and, on commit, hand
   back a value in the SHAPE `TwentyFieldValue` already parses for display (and
   that `updateSabcrmRecordTw` accepts). We deliberately use the canonical /
   simplest shape per type:
   ·  CURRENCY → `{ amount, currencyCode }` (display tolerates this + micros)
   ·  EMAILS / PHONES / MULTI_SELECT / ARRAY → string arrays
   ·  LINKS → `{ label, url }[]`
   ·  ADDRESS → flat `{ street, street2, city, state, postcode, country }`
   ========================================================================= */

/** Narrow an unknown to a plain object record (or null). */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** First non-empty string among the candidates (numbers stringify). */
function firstString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
    if (typeof c === 'number' && !Number.isNaN(c)) return String(c);
  }
  return '';
}

/** Coerce a raw text-input string into the stored value for a scalar field. */
function coerceScalar(field: FieldMetadata, raw: string): unknown {
  if (raw === '') return '';
  if (NUMERIC_INPUT.has(field.type) || field.type === 'RATING') {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

/** Read a CURRENCY value into `{ amount, code }` for editing. */
function readCurrency(value: unknown): { amount: string; code: string } {
  const rec = asRecord(value);
  if (rec) {
    const code = firstString(rec.currencyCode, rec.code) || 'USD';
    if (rec.amountMicros !== undefined && rec.amountMicros !== null) {
      const micros = Number(rec.amountMicros);
      if (!Number.isNaN(micros)) return { amount: String(micros / 1_000_000), code };
    }
    const amount = Number(rec.amount);
    return { amount: Number.isNaN(amount) ? '' : String(amount), code };
  }
  const n = Number(value);
  return { amount: Number.isNaN(n) ? '' : String(n), code: 'USD' };
}

/** Read EMAILS into a flat string list for editing. */
function readEmails(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) =>
        asRecord(v) ? firstString((v as Record<string, unknown>).email, (v as Record<string, unknown>).value) : String(v),
      )
      .filter((s) => s.trim());
  }
  const rec = asRecord(value);
  if (rec) {
    const out: string[] = [];
    const primary = firstString(rec.primaryEmail, rec.email);
    if (primary) out.push(primary);
    if (Array.isArray(rec.additionalEmails)) {
      for (const v of rec.additionalEmails) {
        const s = asRecord(v) ? firstString((v as Record<string, unknown>).email, (v as Record<string, unknown>).value) : String(v);
        if (s.trim()) out.push(s);
      }
    }
    return out;
  }
  return typeof value === 'string' && value.trim() ? [value] : [];
}

/** Read PHONES into a flat string list for editing (display strings). */
function readPhones(value: unknown): string[] {
  const readOne = (raw: unknown): string => {
    if (typeof raw === 'string') return raw.trim();
    const rec = asRecord(raw);
    if (!rec) return '';
    const number = firstString(rec.number, rec.primaryPhoneNumber, rec.phoneNumber, rec.value);
    const calling = firstString(rec.callingCode, rec.primaryPhoneCallingCode);
    if (!number) return '';
    if (!calling) return number;
    const prefix = calling.startsWith('+') ? calling : `+${calling.replace(/[^\d]/g, '')}`;
    return `${prefix} ${number}`;
  };
  if (Array.isArray(value)) return value.map(readOne).filter((s) => s);
  const rec = asRecord(value);
  if (rec) {
    const out: string[] = [];
    const primary = readOne(rec);
    if (primary) out.push(primary);
    const extra = rec.additionalPhones ?? rec.additionalPhoneNumbers;
    if (Array.isArray(extra)) for (const v of extra) {
      const s = readOne(v);
      if (s) out.push(s);
    }
    return out;
  }
  return typeof value === 'string' && value.trim() ? [value] : [];
}

/** A normalised `{ label, url }` link for the LINKS editor. */
interface DraftLink {
  label: string;
  url: string;
}

/** Read LINKS into `{ label, url }[]` for editing. */
function readLinks(value: unknown): DraftLink[] {
  const out: DraftLink[] = [];
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
    return out;
  }
  push(value);
  return out;
}

/** Read ARRAY into a string list for editing. */
function readArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter((s) => s.length > 0);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** Read MULTI_SELECT into a set of selected option values. */
function readMultiSelect(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (value === null || value === undefined || value === '') return [];
  return [String(value)];
}

/** The flat shape the ADDRESS editor edits / commits. */
interface DraftAddress {
  street: string;
  street2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

/** Read an ADDRESS value into the flat editor shape. */
function readAddress(value: unknown): DraftAddress {
  const rec = asRecord(value) ?? {};
  return {
    street: firstString(rec.street, rec.addressStreet1),
    street2: firstString(rec.street2, rec.addressStreet2),
    city: firstString(rec.city, rec.addressCity),
    state: firstString(rec.state, rec.addressState),
    postcode: firstString(rec.postcode, rec.addressPostcode, rec.zip),
    country: firstString(rec.country, rec.addressCountry),
  };
}

/** Format an ISO / date value into a `<input type="date">` value (YYYY-MM-DD). */
function toDateInputValue(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Format into a `<input type="datetime-local">` value (YYYY-MM-DDTHH:mm). */
function toDateTimeInputValue(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* =========================================================================
   Editor sub-components (one per field-type family)
   ========================================================================= */

interface EditorProps {
  field: FieldMetadata;
  value: unknown;
  /** Commit the edited value (parent persists). */
  onCommit: (value: unknown) => void;
  /** Leave edit mode without committing. */
  onCancel: () => void;
}

/** Single-line text / numeric scalar editor (TEXT/EMAIL/PHONE/LINK/NUMBER…). */
function ScalarEditor({ field, value, onCommit, onCancel }: EditorProps): React.JSX.Element {
  const [draft, setDraft] = React.useState(
    value === null || value === undefined ? '' : String(value),
  );
  const commit = () => onCommit(coerceScalar(field, draft));
  return (
    <input
      className="st-cell-input"
      autoFocus
      aria-label={field.label}
      type={NUMERIC_INPUT.has(field.type) ? 'number' : 'text'}
      inputMode={field.type === 'PHONE' ? 'tel' : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

/** Native date / datetime editor (DATE / DATE_TIME). */
function DateEditor({ field, value, onCommit, onCancel }: EditorProps): React.JSX.Element {
  const withTime = field.type === 'DATE_TIME';
  const [draft, setDraft] = React.useState(
    withTime ? toDateTimeInputValue(value) : toDateInputValue(value),
  );
  const commit = (next: string) => {
    if (next === '') {
      onCommit('');
      return;
    }
    const d = new Date(next);
    onCommit(Number.isNaN(d.getTime()) ? next : d.toISOString());
  };
  return (
    <input
      className="st-cell-input"
      autoFocus
      aria-label={field.label}
      type={withTime ? 'datetime-local' : 'date'}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit((e.target as HTMLInputElement).value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

/** Amount + currency-code editor (CURRENCY). Commits `{ amount, currencyCode }`. */
function CurrencyEditor({ field, value, onCommit, onCancel }: EditorProps): React.JSX.Element {
  const initial = React.useMemo(() => readCurrency(value), [value]);
  const [amount, setAmount] = React.useState(initial.amount);
  const [code, setCode] = React.useState(initial.code);
  const commit = () => {
    if (amount === '') {
      onCommit('');
      return;
    }
    const n = Number(amount);
    onCommit({ amount: Number.isNaN(n) ? amount : n, currencyCode: code.trim().toUpperCase() || 'USD' });
  };
  return (
    <span className="st-rfp-currency">
      <input
        className="st-cell-input st-rfp-currency__amount"
        autoFocus
        aria-label={`${field.label} amount`}
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <input
        className="st-cell-input st-rfp-currency__code"
        aria-label={`${field.label} currency code`}
        type="text"
        maxLength={3}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
    </span>
  );
}

/** SELECT dropdown editor — commits the picked option value (or ''). */
function SelectEditor({ field, value, onCommit, onCancel }: EditorProps): React.JSX.Element {
  return (
    <select
      className="st-cell-select"
      autoFocus
      aria-label={field.label}
      defaultValue={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onCommit(e.target.value)}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <option value="">—</option>
      {(field.options ?? []).map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/** MULTI_SELECT checklist popover — commits the selected option-value array. */
function MultiSelectEditor({ field, value, onCommit, onCancel }: EditorProps): React.JSX.Element {
  const [selected, setSelected] = React.useState<string[]>(() => readMultiSelect(value));
  const ref = React.useRef<HTMLDivElement | null>(null);

  // Commit on outside-click / Escape; close cleanly.
  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCommit(selected);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onCommit(selected);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [selected, onCommit, onCancel]);

  const toggle = (optValue: string) =>
    setSelected((prev) =>
      prev.includes(optValue) ? prev.filter((v) => v !== optValue) : [...prev, optValue],
    );

  return (
    <div className="st-rfp-multi" ref={ref}>
      {(field.options ?? []).length === 0 ? (
        <div className="st-rfp-multi__empty">No options.</div>
      ) : (
        (field.options ?? []).map((opt) => {
          const on = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              className="st-rfp-multi__item"
              aria-pressed={on}
              onClick={() => toggle(opt.value)}
            >
              <span className="st-rfp-multi__check" aria-hidden="true">
                {on ? <Check size={12} /> : null}
              </span>
              <span className="st-rfp-multi__label">{opt.label}</span>
            </button>
          );
        })
      )}
    </div>
  );
}

const RATING_MAX = 5;

/** Star-picker editor (RATING) — commits 0–5. */
function RatingEditor({ field, value, onCommit, onCancel }: EditorProps): React.JSX.Element {
  const current = (() => {
    const n = Number(value);
    return Number.isNaN(n) ? 0 : Math.max(0, Math.min(RATING_MAX, Math.round(n)));
  })();
  const [hover, setHover] = React.useState<number | null>(null);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const shown = hover ?? current;
  return (
    <div className="st-rfp-rating" ref={ref} role="radiogroup" aria-label={field.label}>
      {Array.from({ length: RATING_MAX }).map((_, i) => {
        const starValue = i + 1;
        return (
          <button
            key={starValue}
            type="button"
            role="radio"
            aria-checked={starValue === current}
            aria-label={`${starValue} star${starValue === 1 ? '' : 's'}`}
            className={`st-rfp-rating__star${starValue <= shown ? ' is-on' : ''}`}
            onMouseEnter={() => setHover(starValue)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onCommit(starValue)}
          >
            ★
          </button>
        );
      })}
      <button
        type="button"
        className="st-rfp-rating__clear"
        aria-label="Clear rating"
        title="Clear"
        onMouseEnter={() => setHover(0)}
        onMouseLeave={() => setHover(null)}
        onClick={() => onCommit(0)}
      >
        <X size={11} />
      </button>
    </div>
  );
}

/** A reusable add/remove list editor (EMAILS / PHONES / ARRAY). */
function StringListEditor({
  field,
  value,
  onCommit,
  onCancel,
  read,
  itemType,
  itemPlaceholder,
}: EditorProps & {
  read: (v: unknown) => string[];
  itemType: 'email' | 'tel' | 'text';
  itemPlaceholder: string;
}): React.JSX.Element {
  const [items, setItems] = React.useState<string[]>(() => {
    const initial = read(value);
    return initial.length ? initial : [''];
  });
  const ref = React.useRef<HTMLDivElement | null>(null);

  const cleaned = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCommit(cleaned(items));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [items, onCommit, onCancel]);

  const setAt = (idx: number, next: string) =>
    setItems((prev) => prev.map((v, i) => (i === idx ? next : v)));
  const removeAt = (idx: number) =>
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [''];
    });
  const add = () => setItems((prev) => [...prev, '']);

  return (
    <div className="st-rfp-list" ref={ref}>
      {items.map((item, idx) => (
        <div className="st-rfp-list__row" key={idx}>
          <input
            className="st-cell-input"
            autoFocus={idx === 0}
            aria-label={`${field.label} ${idx + 1}`}
            type={itemType}
            value={item}
            placeholder={itemPlaceholder}
            onChange={(e) => setAt(idx, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommit(cleaned(items));
              }
            }}
          />
          <button
            type="button"
            className="st-rfp-list__remove"
            onClick={() => removeAt(idx)}
            aria-label={`Remove ${field.label} ${idx + 1}`}
            title="Remove"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <div className="st-rfp-list__actions">
        <button type="button" className="st-rfp-list__add" onClick={add}>
          <Plus size={12} aria-hidden="true" />
          Add
        </button>
        <button
          type="button"
          className="st-rfp-list__done"
          onClick={() => onCommit(cleaned(items))}
        >
          <Check size={12} aria-hidden="true" />
          Done
        </button>
      </div>
    </div>
  );
}

/** LINKS list editor — commits `{ label, url }[]` (empty rows dropped). */
function LinksEditor({ field, value, onCommit, onCancel }: EditorProps): React.JSX.Element {
  const [links, setLinks] = React.useState<DraftLink[]>(() => {
    const initial = readLinks(value);
    return initial.length ? initial : [{ label: '', url: '' }];
  });
  const ref = React.useRef<HTMLDivElement | null>(null);

  const cleaned = (list: DraftLink[]) =>
    list
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.url || l.label);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCommit(cleaned(links));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [links, onCommit, onCancel]);

  const setAt = (idx: number, patch: Partial<DraftLink>) =>
    setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeAt = (idx: number) =>
    setLinks((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [{ label: '', url: '' }];
    });
  const add = () => setLinks((prev) => [...prev, { label: '', url: '' }]);

  return (
    <div className="st-rfp-list st-rfp-links" ref={ref}>
      {links.map((link, idx) => (
        <div className="st-rfp-links__row" key={idx}>
          <input
            className="st-cell-input st-rfp-links__url"
            autoFocus={idx === 0}
            aria-label={`${field.label} URL ${idx + 1}`}
            type="url"
            value={link.url}
            placeholder="https://…"
            onChange={(e) => setAt(idx, { url: e.target.value })}
          />
          <input
            className="st-cell-input st-rfp-links__label"
            aria-label={`${field.label} label ${idx + 1}`}
            type="text"
            value={link.label}
            placeholder="Label (optional)"
            onChange={(e) => setAt(idx, { label: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommit(cleaned(links));
              }
            }}
          />
          <button
            type="button"
            className="st-rfp-list__remove"
            onClick={() => removeAt(idx)}
            aria-label={`Remove ${field.label} ${idx + 1}`}
            title="Remove"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <div className="st-rfp-list__actions">
        <button type="button" className="st-rfp-list__add" onClick={add}>
          <Plus size={12} aria-hidden="true" />
          Add link
        </button>
        <button
          type="button"
          className="st-rfp-list__done"
          onClick={() => onCommit(cleaned(links))}
        >
          <Check size={12} aria-hidden="true" />
          Done
        </button>
      </div>
    </div>
  );
}

/** ADDRESS multi-field editor — commits the flat address object (or ''). */
function AddressEditor({ field, value, onCommit, onCancel }: EditorProps): React.JSX.Element {
  const [draft, setDraft] = React.useState<DraftAddress>(() => readAddress(value));
  const ref = React.useRef<HTMLDivElement | null>(null);

  const commit = (next: DraftAddress) => {
    const anyFilled = Object.values(next).some((v) => v.trim());
    if (!anyFilled) {
      onCommit('');
      return;
    }
    onCommit({
      street: next.street.trim(),
      street2: next.street2.trim(),
      city: next.city.trim(),
      state: next.state.trim(),
      postcode: next.postcode.trim(),
      country: next.country.trim(),
    });
  };

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) commit(draft);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // commit closes over draft; re-bind whenever draft changes so the latest is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, onCancel]);

  const set = (patch: Partial<DraftAddress>) => setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <div className="st-rfp-address" ref={ref}>
      <input
        className="st-cell-input"
        autoFocus
        aria-label={`${field.label} street`}
        value={draft.street}
        placeholder="Street address"
        onChange={(e) => set({ street: e.target.value })}
      />
      <input
        className="st-cell-input"
        aria-label={`${field.label} street line 2`}
        value={draft.street2}
        placeholder="Apt, suite (optional)"
        onChange={(e) => set({ street2: e.target.value })}
      />
      <div className="st-rfp-address__row">
        <input
          className="st-cell-input"
          aria-label={`${field.label} city`}
          value={draft.city}
          placeholder="City"
          onChange={(e) => set({ city: e.target.value })}
        />
        <input
          className="st-cell-input"
          aria-label={`${field.label} state`}
          value={draft.state}
          placeholder="State"
          onChange={(e) => set({ state: e.target.value })}
        />
      </div>
      <div className="st-rfp-address__row">
        <input
          className="st-cell-input"
          aria-label={`${field.label} postcode`}
          value={draft.postcode}
          placeholder="Postcode"
          onChange={(e) => set({ postcode: e.target.value })}
        />
        <input
          className="st-cell-input"
          aria-label={`${field.label} country`}
          value={draft.country}
          placeholder="Country"
          onChange={(e) => set({ country: e.target.value })}
        />
      </div>
      <div className="st-rfp-list__actions">
        <button
          type="button"
          className="st-rfp-list__done"
          onClick={() => commit(draft)}
        >
          <Check size={12} aria-hidden="true" />
          Done
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   Inline-editable field value (EditableCell dispatch)
   ========================================================================= */

interface FieldValueCellProps {
  field: FieldMetadata;
  value: unknown;
  canEdit: boolean;
  onCommit: (value: unknown) => void;
}

/**
 * One field's value: a click-to-edit inline cell that dispatches to the right
 * editor for the field's type, a plain read-only {@link TwentyFieldValue}
 * otherwise (RELATION + display-only composites, or when `canEdit` is false).
 */
function FieldValueCell({
  field,
  value,
  canEdit,
  onCommit,
}: FieldValueCellProps): React.JSX.Element {
  const [editing, setEditing] = React.useState(false);

  const editable = canEdit && INLINE_EDITABLE.has(field.type);

  const commit = React.useCallback(
    (next: unknown) => {
      setEditing(false);
      // Skip a no-op write (cheap shallow compare; objects/arrays always write).
      if (next !== value) onCommit(next);
    },
    [value, onCommit],
  );
  const cancel = React.useCallback(() => setEditing(false), []);

  // BOOLEAN edits inline with a single click — no separate edit mode.
  if (canEdit && field.type === 'BOOLEAN') {
    const on = Boolean(value);
    return (
      <button
        type="button"
        className={`st-rfp-bool${on ? ' is-on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={field.label}
        title={on ? 'Yes' : 'No'}
        onClick={() => onCommit(!on)}
      >
        <span className="st-rfp-bool__track" aria-hidden="true">
          <span className="st-rfp-bool__thumb" />
        </span>
        <span className="st-rfp-bool__label">{on ? 'Yes' : 'No'}</span>
      </button>
    );
  }

  if (!editable) {
    return <TwentyFieldValue field={field} value={value} />;
  }

  if (!editing) {
    return (
      <span
        className="st-cell-editable"
        role="button"
        tabIndex={0}
        aria-label={`Edit ${field.label}`}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            setEditing(true);
          }
        }}
      >
        <TwentyFieldValue field={field} value={value} />
      </span>
    );
  }

  // Editing — dispatch to the type-appropriate editor.
  const editorProps: EditorProps = { field, value, onCommit: commit, onCancel: cancel };

  switch (field.type) {
    case 'SELECT':
      return <SelectEditor {...editorProps} />;
    case 'MULTI_SELECT':
      return <MultiSelectEditor {...editorProps} />;
    case 'CURRENCY':
      return <CurrencyEditor {...editorProps} />;
    case 'RATING':
      return <RatingEditor {...editorProps} />;
    case 'DATE':
    case 'DATE_TIME':
      return <DateEditor {...editorProps} />;
    case 'ADDRESS':
      return <AddressEditor {...editorProps} />;
    case 'LINKS':
      return <LinksEditor {...editorProps} />;
    case 'EMAILS':
      return (
        <StringListEditor
          {...editorProps}
          read={readEmails}
          itemType="email"
          itemPlaceholder="name@example.com"
        />
      );
    case 'PHONES':
      return (
        <StringListEditor
          {...editorProps}
          read={readPhones}
          itemType="tel"
          itemPlaceholder="+1 555 000 0000"
        />
      );
    case 'ARRAY':
      return (
        <StringListEditor
          {...editorProps}
          read={readArray}
          itemType="text"
          itemPlaceholder="Value"
        />
      );
    case 'TEXT':
    case 'EMAIL':
    case 'PHONE':
    case 'LINK':
    case 'NUMBER':
    case 'NUMERIC':
    default:
      return <ScalarEditor {...editorProps} />;
  }
}

/* =========================================================================
   Field row
   ========================================================================= */

interface FieldRowProps {
  field: FieldMetadata;
  value: unknown;
  canEdit: boolean;
  onUpdate: (key: string, value: unknown) => void;
}

/** One label→value row: field icon + label on the left, value cell on the right. */
function FieldRow({
  field,
  value,
  canEdit,
  onUpdate,
}: FieldRowProps): React.JSX.Element {
  const Icon = iconForField(field);
  return (
    <div className="st-field-row st-rfp-row">
      <span className="st-field-row__key st-rfp-row__key">
        <Icon
          size={14}
          className="st-rfp-row__icon"
          aria-hidden="true"
        />
        <span className="st-rfp-row__label" title={field.label}>
          {field.label}
        </span>
      </span>
      <span className="st-field-row__val st-rfp-row__val">
        <FieldValueCell
          field={field}
          value={value}
          canEdit={canEdit}
          onCommit={(v) => onUpdate(field.key, v)}
        />
      </span>
    </div>
  );
}

/* =========================================================================
   System-field partition (Twenty pins these to the bottom)
   ========================================================================= */

/** Field keys Twenty treats as system metadata (pinned, muted, read-only). */
const SYSTEM_KEYS: ReadonlySet<string> = new Set([
  'createdBy',
  'createdAt',
  'updatedAt',
  'deletedAt',
]);

/** True when a field is system metadata (flagged, or a known system key). */
function isSystemField(field: FieldMetadata): boolean {
  return field.system === true || SYSTEM_KEYS.has(field.key);
}

/**
 * Split the object's fields into the main list and the system group, preserving
 * each field's document order within its group.
 */
function partitionFields(fields: FieldMetadata[]): {
  main: FieldMetadata[];
  system: FieldMetadata[];
} {
  const main: FieldMetadata[] = [];
  const system: FieldMetadata[] = [];
  for (const field of fields) {
    (isSystemField(field) ? system : main).push(field);
  }
  return { main, system };
}

/* =========================================================================
   RecordFieldPanel
   ========================================================================= */

export interface RecordFieldPanelProps {
  /** Object metadata — the source of the field list, order, types + icons. */
  object: ObjectMetadata;
  /** The record being shown; values are read from `record.data[field.key]`. */
  record: SabcrmRustRecord;
  /** Commit one field edit (parent persists via `updateSabcrmRecordTw`). */
  onUpdate: (key: string, value: unknown) => void;
  /** Whether the viewer may edit; false makes every value read-only display. */
  canEdit: boolean;
}

/**
 * Twenty's left-column record field panel: every field of `object` for one
 * `record`, each a label→value row with the right inline editor for its type,
 * system fields grouped at the bottom.
 */
export function RecordFieldPanel({
  object,
  record,
  onUpdate,
  canEdit,
}: RecordFieldPanelProps): React.JSX.Element {
  const { main, system } = React.useMemo(
    () => partitionFields(object.fields),
    [object.fields],
  );

  // `record.data` can be absent for legacy / freshly-created records — read
  // defensively so a missing bag never throws.
  const data = record.data ?? {};

  return (
    <section
      className="st-rfp"
      aria-label={`${object.labelSingular} fields`}
    >
      <div className="st-rfp__group">
        {main.length === 0 ? (
          <div className="st-rfp__empty">No fields to show.</div>
        ) : (
          main.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              value={data[field.key]}
              canEdit={canEdit}
              onUpdate={onUpdate}
            />
          ))
        )}
      </div>

      {system.length > 0 ? (
        <div className="st-rfp__group st-rfp__group--system">
          <div className="st-rfp__group-head">System</div>
          {system.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              value={data[field.key]}
              // System fields are never user-editable, regardless of canEdit.
              canEdit={false}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default RecordFieldPanel;
