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
 * Editing reuses the existing EditableCell pattern (the same one the record list
 * + detail screens use): a click / Enter swaps the read value for an inline
 * input (or a SELECT dropdown), committing on blur / Enter and cancelling on
 * Escape. Only the inline-editable scalar types are made editable; richer types
 * stay read-only display, exactly like the detail page's `EditableValue`. A
 * commit fires `onUpdate(field.key, value)` — the parent owns persistence
 * through the gated `updateSabcrmRecordTw` action (this component never touches
 * the backend).
 *
 * System fields (`createdBy` / `createdAt` / `updatedAt` and any `field.system`)
 * are collected into a muted group pinned to the bottom of the panel, just like
 * Twenty groups its system metadata.
 *
 * NO ZoruUI / Tailwind / clay — Twenty look only: the shared `.st-field-row*` /
 * `.st-cell-*` classes plus a small co-located `.st-rfp-*` block in
 * `record-field-panel.css`. Relies on the `--st-*` tokens from
 * `sabcrm-twenty.css`.
 */

import * as React from 'react';
import {
  AtSign,
  Building2,
  Calendar,
  CalendarClock,
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
  Braces,
  Star,
  Tag,
  Target,
  Text,
  ToggleLeft,
  User,
  UserCheck,
  Users,
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
   Inline-editable type set + value coercion (Twenty / detail-page parity)
   ========================================================================= */

/**
 * The scalar field types that get an inline editor. Richer composites
 * (RELATION, EMAILS, ADDRESS, RICH_TEXT_V2, …) stay read-only display in this
 * panel — exactly the set the record-detail page's `EditableValue` edits.
 */
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
]);

/** Numeric input types — rendered with a `number` input. */
const NUMERIC_INPUT: ReadonlySet<FieldType> = new Set<FieldType>([
  'NUMBER',
  'NUMERIC',
  'CURRENCY',
  'RATING',
]);

/** Coerce a raw input string into the stored value for `field` (Twenty parity). */
function coerceInput(field: FieldMetadata, raw: string): unknown {
  if (raw === '') return '';
  if (NUMERIC_INPUT.has(field.type)) {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

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
   Inline-editable field value (EditableCell pattern)
   ========================================================================= */

interface FieldValueCellProps {
  field: FieldMetadata;
  value: unknown;
  canEdit: boolean;
  onCommit: (value: unknown) => void;
}

/**
 * One field's value: a click-to-edit inline cell for the editable scalar types,
 * a plain read-only {@link TwentyFieldValue} otherwise (or when `canEdit` is
 * false). Mirrors the record-detail page's `EditableValue` behaviour.
 */
function FieldValueCell({
  field,
  value,
  canEdit,
  onCommit,
}: FieldValueCellProps): React.JSX.Element {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  const editable = canEdit && INLINE_EDITABLE.has(field.type);

  if (!editable) {
    return <TwentyFieldValue field={field} value={value} />;
  }

  const begin = () => {
    setDraft(value === null || value === undefined ? '' : String(value));
    setEditing(true);
  };
  const commit = (next: string) => {
    setEditing(false);
    const coerced = coerceInput(field, next);
    if (coerced !== value) onCommit(coerced);
  };

  if (!editing) {
    return (
      <span
        className="st-cell-editable"
        role="button"
        tabIndex={0}
        aria-label={`Edit ${field.label}`}
        onClick={begin}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            begin();
          }
        }}
      >
        <TwentyFieldValue field={field} value={value} />
      </span>
    );
  }

  if (field.type === 'SELECT') {
    return (
      <select
        className="st-cell-select"
        autoFocus
        aria-label={field.label}
        value={draft}
        onChange={(e) => commit(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
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

  return (
    <input
      className="st-cell-input"
      autoFocus
      aria-label={field.label}
      type={NUMERIC_INPUT.has(field.type) ? 'number' : 'text'}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit((e.target as HTMLInputElement).value);
        } else if (e.key === 'Escape') {
          setEditing(false);
        }
      }}
    />
  );
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
 * `record`, each a label→value row with an inline editor for the scalar types,
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
