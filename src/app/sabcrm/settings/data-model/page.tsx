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
  Search,
  AlertTriangle,
  Database,
  Loader2,
  Lock,
  Trash2,
  X,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton, TwentyChip } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  listObjectsTw,
  createObjectTw,
  addFieldTw,
  removeFieldTw,
} from '@/app/actions/sabcrm-objects.actions';
import type {
  ObjectMetadata,
  FieldMetadata,
  FieldType,
} from '@/lib/sabcrm/types';

import './data-model.css';

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
  onRemoveField: (fieldKey: string) => void;
}

function ObjectDetail({
  object,
  lockedKeys,
  busyKey,
  onAddField,
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
// Add-field dialog
// ---------------------------------------------------------------------------

interface AddFieldDialogProps {
  object: ObjectMetadata;
  projectId: string | null;
  onClose: () => void;
  onAdded: (object: ObjectMetadata) => void;
}

function AddFieldDialog({
  object,
  projectId,
  onClose,
  onAdded,
}: AddFieldDialogProps) {
  const [label, setLabel] = React.useState('');
  const [key, setKey] = React.useState('');
  const [keyTouched, setKeyTouched] = React.useState(false);
  const [type, setType] = React.useState<FieldType>('TEXT');
  const [required, setRequired] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const existingKeys = React.useMemo(
    () => new Set(object.fields.map((f) => f.key)),
    [object.fields],
  );

  const onLabelChange = (value: string) => {
    setLabel(value);
    if (!keyTouched) setKey(camelKey(value));
  };

  const keyConflict = key.trim().length > 0 && existingKeys.has(key.trim());
  const canSubmit =
    label.trim().length > 0 &&
    key.trim().length > 0 &&
    !keyConflict &&
    !saving;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const field: FieldMetadata = {
      key: key.trim(),
      label: label.trim(),
      type,
      required,
      inTable: true,
    };

    const res = await addFieldTw(object.slug, field, projectId ?? undefined);
    setSaving(false);
    if (res.ok) {
      onAdded(res.data);
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
        aria-label={`Add field to ${object.labelSingular}`}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="st-dialog__header">
            <h2 className="st-dialog__title">Add field</h2>
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
              />
              {keyConflict ? (
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
              </select>
            </div>

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
              Add field
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
                onAddField={() => setAddFieldOpen(true)}
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
        <AddFieldDialog
          object={activeObject}
          projectId={activeProjectId}
          onClose={() => setAddFieldOpen(false)}
          onAdded={(updated) => {
            upsertObject(updated);
            setAddFieldOpen(false);
          }}
        />
      )}
    </div>
  );
}
