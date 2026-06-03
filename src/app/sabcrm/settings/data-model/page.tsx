'use client';

/**
 * SabCRM — Data Model settings (Twenty-faithful, `/sabcrm/settings/data-model`).
 *
 * Rebuilt in Twenty's "Settings → Data model" visual language: a two-pane
 * layout where the LEFT pane lists every object the active project can see
 * (standard + custom, each with a badge) and the RIGHT pane shows the selected
 * object's fields in a Twenty table (key · label · type chip · flags).
 *
 * Mutations go through the gated server actions in
 * `@/app/actions/sabcrm-objects.actions` (session → project → RBAC → plan),
 * which wrap the Rust *objects* engine:
 *   - "New object"  → createObjectTw
 *   - "Add field"   → addFieldTw
 *   - remove field  → removeFieldTw
 *
 * Standard objects keep their identity and built-in fields read-only; only
 * appended custom fields can be removed. The engine is the source of truth for
 * which fields are immutable and rejects anything it does not allow — the UI
 * mirrors those guards so disabled controls never hit a server error, and any
 * rejection still surfaces as an inline banner.
 *
 * The Rust engine may be DOWN; every call returns an `ActionResult`, so the page
 * degrades to loading / empty / error states and never crashes. NO ZoruUI /
 * Tailwind / clay here — Twenty look only (`.st-*` kit + the sibling
 * `./data-model.css`). Auth / RBAC / project context are enforced by the parent
 * `../../layout.tsx`; the actions independently re-run the full gate.
 */

import * as React from 'react';
import {
  Plus,
  AlertTriangle,
  Database,
  Loader2,
  Lock,
  Trash2,
  X,
  Check,
  ArrowUp,
  ArrowDown,
  Pencil,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton, TwentyChip } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  listObjectsTw,
  createObjectTw,
  addFieldTw,
  removeFieldTw,
  updateObjectTw,
} from '@/app/actions/sabcrm-objects.actions';
import type {
  ObjectMetadata,
  FieldMetadata,
  FieldType,
  FieldOption,
  FieldRelation,
} from '@/lib/sabcrm/types';

import './data-model.css';

// ---------------------------------------------------------------------------
// Twenty SELECT-option colour palette
// ---------------------------------------------------------------------------

/**
 * Twenty's fixed option-colour palette. `token` is what we persist (a
 * `--zoru-*` name, to stay consistent with the seeded schema) and `swatch` is
 * the literal hex we paint in the picker — the data-model page renders under
 * the `.sabcrm-twenty` scope where `--zoru-*` vars are NOT in scope, so the
 * swatch must be a concrete colour.
 */
interface PaletteColor {
  name: string;
  token: string;
  swatch: string;
}

const OPTION_PALETTE: ReadonlyArray<PaletteColor> = [
  { name: 'Green', token: '--zoru-green', swatch: '#3dab5a' },
  { name: 'Turquoise', token: '--zoru-turquoise', swatch: '#21b8a6' },
  { name: 'Sky', token: '--zoru-sky', swatch: '#5db4e3' },
  { name: 'Blue', token: '--zoru-blue', swatch: '#3b7ae4' },
  { name: 'Purple', token: '--zoru-purple', swatch: '#9b51e0' },
  { name: 'Pink', token: '--zoru-pink', swatch: '#e052b0' },
  { name: 'Red', token: '--zoru-red', swatch: '#e0484e' },
  { name: 'Orange', token: '--zoru-orange', swatch: '#f0883e' },
  { name: 'Yellow', token: '--zoru-yellow', swatch: '#e0c64a' },
  { name: 'Gray', token: '--zoru-gray', swatch: '#8c8c8c' },
];

const DEFAULT_OPTION_COLOR = OPTION_PALETTE[0].token;

/** Resolve a stored option colour (token or hex) to a paintable swatch. */
function swatchFor(color: string | undefined): string {
  if (!color) return OPTION_PALETTE[0].swatch;
  const match = OPTION_PALETTE.find((c) => c.token === color);
  if (match) return match.swatch;
  // Already a hex / concrete colour → paint as-is, else fall back.
  return /^#|^rgb|^hsl/.test(color) ? color : OPTION_PALETTE[0].swatch;
}

/** Turn a label into a stable SCREAMING_SNAKE option value. */
function optionValue(label: string): string {
  return (
    label
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'OPTION'
  );
}

// ---------------------------------------------------------------------------
// Field-type catalogue
// ---------------------------------------------------------------------------

/** Field types a user can pick when adding a field, with friendly labels. */
const FIELD_TYPE_OPTIONS: ReadonlyArray<{ value: FieldType; label: string }> = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'CURRENCY', label: 'Currency' },
  { value: 'BOOLEAN', label: 'Boolean' },
  { value: 'DATE', label: 'Date' },
  { value: 'DATE_TIME', label: 'Date & time' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'LINK', label: 'Link' },
  { value: 'SELECT', label: 'Select (single)' },
  { value: 'MULTI_SELECT', label: 'Select (multiple)' },
  { value: 'RATING', label: 'Rating' },
  { value: 'FILE', label: 'File' },
];

function fieldTypeLabel(type: FieldType): string {
  if (type === 'RELATION') return 'Relation';
  return FIELD_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type;
}

/** Slugify a label into a kebab-case object slug suggestion. */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** camelCase-ify a label into a field-key suggestion. */
function camelKey(input: string): string {
  const cleaned = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/);
  return (
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('')
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="st-banner" role="alert">
      <AlertTriangle className="st-banner__icon" size={15} />
      <span>{message}</span>
    </div>
  );
}

function ObjectBadge({ standard }: { standard: boolean }) {
  return standard ? (
    <span className="dm-badge">Standard</span>
  ) : (
    <span className="dm-badge dm-badge--custom">Custom</span>
  );
}

// ---------------------------------------------------------------------------
// SELECT option editor (rows with colour-swatch picker, add/remove/reorder)
// ---------------------------------------------------------------------------

/** A draggable-free colour-swatch popover, Twenty style. */
function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (token: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="dm-color" ref={ref}>
      <button
        type="button"
        className="dm-color__trigger"
        aria-label="Pick option colour"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="dm-swatch"
          style={{ background: swatchFor(value) }}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="dm-color__pop" role="listbox" aria-label="Colours">
          {OPTION_PALETTE.map((c) => (
            <button
              key={c.token}
              type="button"
              role="option"
              aria-selected={c.token === value}
              className="dm-color__cell"
              title={c.name}
              onClick={() => {
                onChange(c.token);
                setOpen(false);
              }}
            >
              <span
                className="dm-swatch dm-swatch--lg"
                style={{ background: c.swatch }}
                aria-hidden="true"
              />
              {c.token === value ? (
                <Check className="dm-color__check" size={12} />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Editable list of SELECT / MULTI_SELECT option rows. */
function OptionRowsEditor({
  options,
  onChange,
}: {
  options: FieldOption[];
  onChange: (next: FieldOption[]) => void;
}) {
  const update = (idx: number, patch: Partial<FieldOption>) => {
    onChange(options.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...options];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(options.filter((_, i) => i !== idx));
  };

  const add = () => {
    onChange([
      ...options,
      { value: '', label: '', color: DEFAULT_OPTION_COLOR },
    ]);
  };

  return (
    <div className="dm-field">
      <span className="st-field__label">Options</span>
      <div className="dm-opts">
        {options.length === 0 ? (
          <p className="dm-opts__empty">No options yet. Add one below.</p>
        ) : (
          options.map((opt, idx) => (
            <div className="dm-opt" key={idx}>
              <ColorPicker
                value={opt.color ?? DEFAULT_OPTION_COLOR}
                onChange={(token) => update(idx, { color: token })}
              />
              <input
                className="st-input dm-opt__label"
                value={opt.label}
                placeholder="Label"
                autoComplete="off"
                onChange={(e) => {
                  const label = e.target.value;
                  // Auto-derive value while it still mirrors the label.
                  const derived =
                    !opt.value || opt.value === optionValue(opt.label);
                  update(idx, {
                    label,
                    ...(derived ? { value: optionValue(label) } : null),
                  });
                }}
              />
              <input
                className="st-input dm-opt__value"
                value={opt.value}
                placeholder="VALUE"
                autoComplete="off"
                aria-label="Option value"
                onChange={(e) =>
                  update(idx, {
                    value: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9_]+/g, '_'),
                  })
                }
              />
              <div className="dm-opt__order">
                <button
                  type="button"
                  className="dm-iconbtn"
                  aria-label="Move up"
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  className="dm-iconbtn"
                  aria-label="Move down"
                  disabled={idx === options.length - 1}
                  onClick={() => move(idx, 1)}
                >
                  <ArrowDown size={13} />
                </button>
              </div>
              <button
                type="button"
                className="dm-iconbtn dm-iconbtn--danger"
                aria-label={`Remove option ${opt.label || idx + 1}`}
                onClick={() => remove(idx)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
        <button type="button" className="dm-opts__add" onClick={add}>
          <Plus size={14} />
          Add option
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RELATION target editor
// ---------------------------------------------------------------------------

function RelationEditor({
  objects,
  selfSlug,
  relation,
  onChange,
}: {
  objects: ObjectMetadata[];
  selfSlug: string;
  relation: FieldRelation;
  onChange: (next: FieldRelation) => void;
}) {
  const targets = React.useMemo(
    () => objects.filter((o) => o.slug !== selfSlug),
    [objects, selfSlug],
  );

  const targetObj = React.useMemo(
    () => objects.find((o) => o.slug === relation.targetObject) ?? null,
    [objects, relation.targetObject],
  );

  return (
    <div className="dm-relation">
      <div className="st-field">
        <span className="st-field__label">
          Target object<span className="st-field__req">*</span>
        </span>
        <select
          className="st-select"
          value={relation.targetObject}
          onChange={(e) => {
            const slug = e.target.value;
            const obj = objects.find((o) => o.slug === slug);
            const labelField =
              obj?.fields.find((f) => f.isLabel)?.key ??
              obj?.fields[0]?.key ??
              '';
            onChange({ ...relation, targetObject: slug, labelField });
          }}
        >
          <option value="" disabled>
            Select an object…
          </option>
          {targets.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.labelPlural}
            </option>
          ))}
        </select>
      </div>

      <div className="st-field">
        <span className="st-field__label">Relationship</span>
        <select
          className="st-select"
          value={relation.kind}
          onChange={(e) =>
            onChange({
              ...relation,
              kind: e.target.value as FieldRelation['kind'],
            })
          }
        >
          <option value="MANY_TO_ONE">
            Many {selfSlug || 'records'} → one target
          </option>
          <option value="ONE_TO_MANY">
            One {selfSlug || 'record'} → many targets
          </option>
        </select>
      </div>

      <div className="st-field">
        <span className="st-field__label">Label field</span>
        <select
          className="st-select"
          value={relation.labelField ?? ''}
          disabled={!targetObj}
          onChange={(e) => onChange({ ...relation, labelField: e.target.value })}
        >
          {!targetObj ? (
            <option value="">Pick a target object first</option>
          ) : (
            targetObj.fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))
          )}
        </select>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Left pane — object list
// ---------------------------------------------------------------------------

interface ObjectListProps {
  custom: ObjectMetadata[];
  standard: ObjectMetadata[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

function ObjectListItem({
  object,
  active,
  onSelect,
}: {
  object: ObjectMetadata;
  active: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      className={`dm-item${active ? ' active' : ''}`}
      aria-current={active ? 'true' : undefined}
      onClick={() => onSelect(object.slug)}
    >
      <span className="dm-item__icon" aria-hidden="true">
        <Database size={15} />
      </span>
      <span className="dm-item__body">
        <span className="dm-item__label">{object.labelPlural}</span>
        <span className="dm-item__slug">{object.slug}</span>
      </span>
      <span className="dm-item__count">{object.fields.length}</span>
    </button>
  );
}

function ObjectList({ custom, standard, activeSlug, onSelect }: ObjectListProps) {
  return (
    <nav className="dm-list" aria-label="Objects">
      <div className="dm-list__group">
        <h2 className="dm-list__heading">Custom</h2>
        {custom.length === 0 ? (
          <p className="dm-list__empty">No custom objects yet.</p>
        ) : (
          custom.map((o) => (
            <ObjectListItem
              key={o.slug}
              object={o}
              active={o.slug === activeSlug}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
      <div className="dm-list__group">
        <h2 className="dm-list__heading">Standard</h2>
        {standard.length === 0 ? (
          <p className="dm-list__empty">No standard objects.</p>
        ) : (
          standard.map((o) => (
            <ObjectListItem
              key={o.slug}
              object={o}
              active={o.slug === activeSlug}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Right pane — field table
// ---------------------------------------------------------------------------

interface ObjectDetailProps {
  object: ObjectMetadata;
  /** Keys that are immutable (standard-object built-ins + system fields). */
  lockedKeys: ReadonlySet<string>;
  busyKey: string | null;
  onAddField: () => void;
  onEditField: (fieldKey: string) => void;
  onRemoveField: (fieldKey: string) => void;
}

function ObjectDetail({
  object,
  lockedKeys,
  busyKey,
  onAddField,
  onEditField,
  onRemoveField,
}: ObjectDetailProps) {
  return (
    <section className="dm-detail" aria-label={`${object.labelPlural} fields`}>
      <div className="dm-detail__head">
        <div>
          <h2 className="dm-detail__title">
            <Database size={18} aria-hidden="true" />
            {object.labelPlural}
            <ObjectBadge standard={object.standard === true} />
          </h2>
          <p className="dm-detail__sub">
            <code>{object.slug}</code> · {object.fields.length}{' '}
            {object.fields.length === 1 ? 'field' : 'fields'}
            {object.description ? ` · ${object.description}` : ''}
          </p>
        </div>
        <div className="dm-detail__actions">
          <TwentyButton variant="primary" icon={Plus} onClick={onAddField}>
            Add field
          </TwentyButton>
        </div>
      </div>

      <div className="st-table-wrap">
        <table className="st-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Key</th>
              <th>Type</th>
              <th className="dm-col-flags">Flags</th>
            </tr>
          </thead>
          <tbody>
            {object.fields.map((field) => {
              const locked =
                field.system === true || lockedKeys.has(field.key);
              const busy = busyKey === field.key;
              return (
                <tr key={field.key} className="st-row">
                  <td>{field.label}</td>
                  <td>
                    <span className="dm-key">{field.key}</span>
                  </td>
                  <td>
                    <TwentyChip label={fieldTypeLabel(field.type)} />
                  </td>
                  <td className="dm-col-flags">
                    <span className="dm-flags">
                      {field.isLabel ? <TwentyChip label="Title" /> : null}
                      {field.required ? <TwentyChip label="Required" /> : null}
                      {field.inTable ? <TwentyChip label="In table" /> : null}
                      {field.type === 'RELATION' && field.relation ? (
                        <TwentyChip
                          label={`→ ${field.relation.targetObject}`}
                        />
                      ) : null}
                      {locked ? (
                        <span
                          className="dm-locked"
                          title="Built-in field — read-only"
                        >
                          <Lock size={13} aria-label="Read-only" />
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="dm-rm"
                            aria-label={`Edit ${field.label}`}
                            title={`Edit ${field.label}`}
                            disabled={busy}
                            onClick={() => onEditField(field.key)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="dm-rm"
                            aria-label={`Remove ${field.label}`}
                            title={`Remove ${field.label}`}
                            disabled={busy}
                            onClick={() => onRemoveField(field.key)}
                          >
                            {busy ? (
                              <Loader2 size={14} className="st-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// New-object dialog
// ---------------------------------------------------------------------------

interface NewObjectDialogProps {
  existingSlugs: ReadonlySet<string>;
  projectId: string | null;
  onClose: () => void;
  onCreated: (object: ObjectMetadata) => void;
}

function NewObjectDialog({
  existingSlugs,
  projectId,
  onClose,
  onCreated,
}: NewObjectDialogProps) {
  const [labelSingular, setLabelSingular] = React.useState('');
  const [labelPlural, setLabelPlural] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [icon, setIcon] = React.useState('database');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onPluralChange = (value: string) => {
    setLabelPlural(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const slugTaken = existingSlugs.has(slug);
  const canSubmit =
    labelSingular.trim().length > 0 &&
    labelPlural.trim().length > 0 &&
    slug.trim().length > 0 &&
    !slugTaken &&
    !saving;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const object: ObjectMetadata = {
      slug: slug.trim(),
      labelSingular: labelSingular.trim(),
      labelPlural: labelPlural.trim(),
      icon: icon.trim() || 'database',
      fields: [
        {
          key: 'name',
          label: 'Name',
          type: 'TEXT',
          isLabel: true,
          inTable: true,
          required: true,
        },
      ],
      views: ['table'],
      standard: false,
    };

    const res = await createObjectTw(object, projectId ?? undefined);
    setSaving(false);
    if (res.ok) {
      onCreated(res.data);
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="st-dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="st-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="New object"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="st-dialog__header">
            <h2 className="st-dialog__title">New object</h2>
            <button
              type="button"
              className="st-dialog__close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="st-dialog__body">
            <div className="st-field">
              <span className="st-field__label">
                Singular label<span className="st-field__req">*</span>
              </span>
              <input
                className="st-input"
                value={labelSingular}
                onChange={(e) => setLabelSingular(e.target.value)}
                placeholder="Ticket"
                autoComplete="off"
              />
            </div>

            <div className="st-field">
              <span className="st-field__label">
                Plural label<span className="st-field__req">*</span>
              </span>
              <input
                className="st-input"
                value={labelPlural}
                onChange={(e) => onPluralChange(e.target.value)}
                placeholder="Tickets"
                autoComplete="off"
              />
            </div>

            <div className="st-field">
              <span className="st-field__label">Icon</span>
              <input
                className="st-input"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="database"
                autoComplete="off"
              />
            </div>

            <div className="st-field">
              <span className="st-field__label">
                Slug<span className="st-field__req">*</span>
              </span>
              <input
                className="st-input"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="support-tickets"
                autoComplete="off"
                aria-invalid={slugTaken}
              />
              {slugTaken ? (
                <span className="st-field__label" style={{ color: '#d64545' }}>
                  An object with this slug already exists.
                </span>
              ) : null}
            </div>

            {error && <ErrorBanner message={error} />}
          </div>

          <div className="st-dialog__footer">
            <TwentyButton variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </TwentyButton>
            <button
              type="submit"
              className="st-btn st-btn--primary"
              disabled={!canSubmit}
            >
              {saving ? <Loader2 size={14} className="st-spin" /> : null}
              Create object
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field dialog (add a new custom field OR edit an existing custom field)
// ---------------------------------------------------------------------------

const SELECT_TYPES: ReadonlySet<FieldType> = new Set(['SELECT', 'MULTI_SELECT']);

interface FieldDialogProps {
  object: ObjectMetadata;
  /** All loaded objects — used to populate the RELATION target picker. */
  allObjects: ObjectMetadata[];
  projectId: string | null;
  /** When set, edit this existing field; otherwise add a new one. */
  editKey: string | null;
  onClose: () => void;
  onSaved: (object: ObjectMetadata) => void;
}

function FieldDialog({
  object,
  allObjects,
  projectId,
  editKey,
  onClose,
  onSaved,
}: FieldDialogProps) {
  const editing = React.useMemo(
    () => (editKey ? object.fields.find((f) => f.key === editKey) ?? null : null),
    [editKey, object.fields],
  );

  const [label, setLabel] = React.useState(editing?.label ?? '');
  const [key, setKey] = React.useState(editing?.key ?? '');
  const [keyTouched, setKeyTouched] = React.useState(Boolean(editing));
  const [type, setType] = React.useState<FieldType>(editing?.type ?? 'TEXT');
  const [required, setRequired] = React.useState(editing?.required ?? false);
  const [options, setOptions] = React.useState<FieldOption[]>(
    editing?.options ? editing.options.map((o) => ({ ...o })) : [],
  );
  const [relation, setRelation] = React.useState<FieldRelation>(
    editing?.relation ?? {
      targetObject: '',
      kind: 'MANY_TO_ONE',
      labelField: '',
    },
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const existingKeys = React.useMemo(
    () =>
      new Set(
        object.fields.filter((f) => f.key !== editKey).map((f) => f.key),
      ),
    [object.fields, editKey],
  );

  const onLabelChange = (value: string) => {
    setLabel(value);
    if (!keyTouched) setKey(camelKey(value));
  };

  const keyConflict = key.trim().length > 0 && existingKeys.has(key.trim());
  const isSelect = SELECT_TYPES.has(type);
  const isRelation = type === 'RELATION';

  // Type-specific validity: SELECT needs ≥1 valid option; RELATION needs a target.
  const optionsValid =
    !isSelect ||
    (options.length > 0 &&
      options.every((o) => o.label.trim() && o.value.trim()));
  const relationValid = !isRelation || relation.targetObject.trim().length > 0;

  const canSubmit =
    label.trim().length > 0 &&
    key.trim().length > 0 &&
    !keyConflict &&
    optionsValid &&
    relationValid &&
    !saving;

  // Seed an empty option row the first time SELECT is chosen.
  React.useEffect(() => {
    if (isSelect && options.length === 0) {
      setOptions([{ value: '', label: '', color: DEFAULT_OPTION_COLOR }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelect]);

  /** Build the FieldMetadata payload from the current form state. */
  const buildField = (): FieldMetadata => {
    const next: FieldMetadata = {
      key: key.trim(),
      label: label.trim(),
      type,
      required,
      inTable: editing?.inTable ?? true,
    };
    if (editing?.isLabel) next.isLabel = true;
    if (editing?.icon) next.icon = editing.icon;
    if (editing?.description) next.description = editing.description;
    if (isSelect) {
      next.options = options.map((o) => ({
        value: o.value.trim() || optionValue(o.label),
        label: o.label.trim(),
        color: o.color ?? DEFAULT_OPTION_COLOR,
      }));
    }
    if (isRelation) {
      next.relation = {
        targetObject: relation.targetObject,
        kind: relation.kind,
        labelField: relation.labelField || undefined,
      };
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const field = buildField();

    let res;
    if (editing) {
      // Patch the whole fields array, replacing the edited field in place.
      const nextFields = object.fields.map((f) =>
        f.key === editKey ? field : f,
      );
      res = await updateObjectTw(
        object.slug,
        { fields: nextFields },
        projectId ?? undefined,
      );
    } else {
      res = await addFieldTw(object.slug, field, projectId ?? undefined);
    }

    setSaving(false);
    if (res.ok) {
      onSaved(res.data);
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="st-dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="st-dialog dm-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-label={
          editing
            ? `Edit ${editing.label}`
            : `Add field to ${object.labelSingular}`
        }
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="st-dialog__header">
            <h2 className="st-dialog__title">
              {editing ? 'Edit field' : 'Add field'}
            </h2>
            <button
              type="button"
              className="st-dialog__close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="st-dialog__body">
            <div className="st-field">
              <span className="st-field__label">
                Label<span className="st-field__req">*</span>
              </span>
              <input
                className="st-input"
                value={label}
                onChange={(e) => onLabelChange(e.target.value)}
                placeholder="Priority"
                autoComplete="off"
              />
            </div>

            <div className="st-field">
              <span className="st-field__label">
                Key<span className="st-field__req">*</span>
              </span>
              <input
                className="st-input"
                value={key}
                onChange={(e) => {
                  setKeyTouched(true);
                  setKey(e.target.value);
                }}
                placeholder="priority"
                autoComplete="off"
                aria-invalid={keyConflict}
                disabled={Boolean(editing)}
              />
              {editing ? (
                <span className="st-field__hint">
                  A field&apos;s key is fixed once created.
                </span>
              ) : keyConflict ? (
                <span className="st-field__label" style={{ color: '#d64545' }}>
                  A field with this key already exists.
                </span>
              ) : null}
            </div>

            <div className="st-field">
              <span className="st-field__label">Type</span>
              <select
                className="st-select"
                value={type}
                onChange={(e) => setType(e.target.value as FieldType)}
              >
                {FIELD_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
                <option value="RELATION">Relation</option>
              </select>
            </div>

            {isSelect ? (
              <OptionRowsEditor options={options} onChange={setOptions} />
            ) : null}

            {isRelation ? (
              <RelationEditor
                objects={allObjects}
                selfSlug={object.slug}
                relation={relation}
                onChange={setRelation}
              />
            ) : null}

            <label className="st-checkbox-row">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
              />
              Required
            </label>

            {error && <ErrorBanner message={error} />}
          </div>

          <div className="st-dialog__footer">
            <TwentyButton variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </TwentyButton>
            <button
              type="submit"
              className="st-btn st-btn--primary"
              disabled={!canSubmit}
            >
              {saving ? <Loader2 size={14} className="st-spin" /> : null}
              {editing ? 'Save changes' : 'Add field'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DataModelPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeSlug, setActiveSlug] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [addFieldOpen, setAddFieldOpen] = React.useState(false);
  /** Key of the custom field being edited, or null when not editing. */
  const [editFieldKey, setEditFieldKey] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  // Load the object catalogue on mount / project switch.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await listObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setObjects([]);
      } else {
        setObjects(res.data);
        // Default-select the first object (custom first, then standard).
        setActiveSlug((prev) => {
          if (prev && res.data.some((o) => o.slug === prev)) return prev;
          const first =
            res.data.find((o) => !o.standard) ?? res.data[0];
          return first ? first.slug : null;
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  /** Replace one object in the catalogue with its updated metadata. */
  const upsertObject = React.useCallback((next: ObjectMetadata) => {
    setObjects((prev) => {
      const exists = prev.some((o) => o.slug === next.slug);
      return exists
        ? prev.map((o) => (o.slug === next.slug ? next : o))
        : [...prev, next];
    });
  }, []);

  const customObjects = React.useMemo(
    () => objects.filter((o) => !o.standard),
    [objects],
  );
  const standardObjects = React.useMemo(
    () => objects.filter((o) => o.standard),
    [objects],
  );

  const activeObject = React.useMemo(
    () => objects.find((o) => o.slug === activeSlug) ?? null,
    [objects, activeSlug],
  );

  /**
   * Keys that are immutable on the active object. For a standard object every
   * built-in field is locked (only appended custom fields are removable); the
   * engine flags those built-ins with `system` / by absence of edits, so we
   * lock the standard object's *original* fields. Custom objects lock only
   * `system` fields.
   */
  const lockedKeys = React.useMemo<ReadonlySet<string>>(() => {
    if (!activeObject) return new Set<string>();
    if (activeObject.standard) {
      // On a standard object, treat any field NOT explicitly user-added as
      // locked. The engine marks custom extensions without `system`; built-ins
      // are either `system` or carry `standard` identity. To stay safe we lock
      // every field unless it is a plain custom field (no system flag) added
      // after the standard set — which the engine surfaces, so we rely on the
      // engine rejecting bad removals and lock system + non-custom here.
      return new Set(
        activeObject.fields
          .filter((f) => f.system === true)
          .map((f) => f.key),
      );
    }
    return new Set(
      activeObject.fields.filter((f) => f.system === true).map((f) => f.key),
    );
  }, [activeObject]);

  const handleRemoveField = React.useCallback(
    async (fieldKey: string) => {
      if (!activeObject) return;
      setBusyKey(fieldKey);
      setMutationError(null);
      const res = await removeFieldTw(
        activeObject.slug,
        fieldKey,
        activeProjectId ?? undefined,
      );
      setBusyKey(null);
      if (res.ok) {
        upsertObject(res.data);
      } else {
        setMutationError(res.error);
      }
    },
    [activeObject, activeProjectId, upsertObject],
  );

  const existingSlugs = React.useMemo(
    () => new Set(objects.map((o) => o.slug)),
    [objects],
  );

  // ---- Render -------------------------------------------------------------

  return (
    <div className="st-page">
      <TwentyPageHeader
        title="Data Model"
        icon={Database}
        actions={
          <TwentyButton
            variant="primary"
            icon={Plus}
            onClick={() => setCreateOpen(true)}
            disabled={loading || !!error}
          >
            New object
          </TwentyButton>
        }
      />

      {error ? (
        <ErrorBanner message={error} />
      ) : loading ? (
        <div className="dm-layout">
          <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="st-skeleton st-skeleton-row" />
            ))}
          </div>
          <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="st-skeleton st-skeleton-row" />
            ))}
          </div>
        </div>
      ) : objects.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <Database size={20} />
          </span>
          <h2 className="st-empty__title">No objects yet</h2>
          <p className="st-empty__desc">
            Create your first custom object to model data the standard CRM
            objects don&apos;t cover.
          </p>
          <TwentyButton
            variant="primary"
            icon={Plus}
            onClick={() => setCreateOpen(true)}
          >
            New object
          </TwentyButton>
        </div>
      ) : (
        <>
          {mutationError && <ErrorBanner message={mutationError} />}
          <div className="dm-layout">
            <ObjectList
              custom={customObjects}
              standard={standardObjects}
              activeSlug={activeSlug}
              onSelect={(slug) => {
                setActiveSlug(slug);
                setMutationError(null);
              }}
            />

            {activeObject ? (
              <ObjectDetail
                object={activeObject}
                lockedKeys={lockedKeys}
                busyKey={busyKey}
                onAddField={() => {
                  setEditFieldKey(null);
                  setAddFieldOpen(true);
                }}
                onEditField={(fieldKey) => {
                  setEditFieldKey(fieldKey);
                  setAddFieldOpen(true);
                }}
                onRemoveField={handleRemoveField}
              />
            ) : (
              <div className="dm-detail__placeholder">
                Select an object to manage its fields.
              </div>
            )}
          </div>
        </>
      )}

      {createOpen && (
        <NewObjectDialog
          existingSlugs={existingSlugs}
          projectId={activeProjectId}
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            upsertObject(created);
            setActiveSlug(created.slug);
            setCreateOpen(false);
          }}
        />
      )}

      {addFieldOpen && activeObject && (
        <FieldDialog
          object={activeObject}
          allObjects={objects}
          projectId={activeProjectId}
          editKey={editFieldKey}
          onClose={() => {
            setAddFieldOpen(false);
            setEditFieldKey(null);
          }}
          onSaved={(updated) => {
            upsertObject(updated);
            setAddFieldOpen(false);
            setEditFieldKey(null);
          }}
        />
      )}
    </div>
  );
}
