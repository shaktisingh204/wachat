'use client';

/**
 * SabCRM — Segments (smart lists) settings (`/dashboard/settings/crm/segments`),
 * Twenty-style.
 *
 * A segment is a saved, named, filtered view of a single object — Twenty's
 * "smart list" concept. Each segment pins an object, a structured filter
 * predicate, an optional sort, and a display color. The page renders the
 * segments as a card grid; every card shows its color dot, name, target
 * object, and a LIVE record count fetched through `countSabcrmRecordsTw` with
 * that segment's own filters, and links to `/sabcrm/{object}?segment={id}`
 * so the index page can open pre-filtered.
 *
 * CRUD is handled by `@/app/actions/sabcrm-segments.actions`
 * (`listSegmentsTw` / `createSegmentTw` / `updateSegmentTw` / `deleteSegmentTw`),
 * each of which independently re-runs the session → project → RBAC → plan
 * pipeline server-side, so the page fails closed. The object catalogue comes
 * from `listSabcrmObjectsTw`.
 *
 * The "New segment" dialog offers a name, an object select, a color swatch
 * picker, and a small field=value filter builder (a couple of equality
 * conditions). The same dialog edits an existing segment.
 *
 * States: skeleton while the project / data load, a "no project" notice, an
 * empty state, an error banner, and graceful degradation (counts that fail to
 * resolve simply show "—") so the engine being unreachable never crashes the
 * page.
 */

import * as React from 'react';
import {
  ListFilter,
  AlertTriangle,
  Plus,
  X,
  Pencil,
  Trash2,
  ArrowRight,
  Database,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  listSegmentsTw,
  createSegmentTw,
  updateSegmentTw,
  deleteSegmentTw,
} from '@/app/actions/sabcrm-segments.actions';
import {
  listSabcrmObjectsTw,
  countSabcrmRecordsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../settings-twenty.css';
import './segments.css';

// ---------------------------------------------------------------------------
// Wire shapes
//
// Declared locally to keep this client page free of any `server-only` import.
// Mirror the `@/app/actions/sabcrm-segments.actions` contract:
//   segment { id, name, object, filters, sortBy?, sortDir?, color? }
// where `filters` is the engine's flat field→condition map.
// ---------------------------------------------------------------------------

/** One leaf condition in the engine's flat-map filter form. */
interface SegmentCondition {
  op: 'eq' | 'contains';
  value: string;
}

/** Flat `{ <fieldKey>: condition }` map ANDed together by the engine. */
type SegmentFilters = Record<string, SegmentCondition | string>;

interface CrmSegment {
  id: string;
  name: string;
  object: string;
  filters: SegmentFilters;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  color?: string;
}

/** Input accepted by `createSegmentTw` / `updateSegmentTw` (sans id). */
interface SegmentInput {
  name: string;
  object: string;
  filters: SegmentFilters;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  color?: string;
}

// ---------------------------------------------------------------------------
// Color palette — a fixed Twenty-style swatch set so a segment always has a
// readable dot. Values are plain hex so they round-trip through the action
// without depending on theme tokens.
// ---------------------------------------------------------------------------

const SEGMENT_COLORS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#64748b', label: 'Slate' },
];

const DEFAULT_COLOR = SEGMENT_COLORS[0].value;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolves the human plural label for an object slug, falling back to slug. */
function objectLabel(slug: string, objects: ObjectMetadata[]): string {
  const o = objects.find((x) => x.slug === slug);
  return o?.labelPlural ?? slug;
}

/** Selectable (text-ish) fields for the builder, in table order then rest. */
function builderFields(object: string, objects: ObjectMetadata[]) {
  const o = objects.find((x) => x.slug === object);
  if (!o) return [];
  return [...o.fields]
    .filter((f) => f.type !== 'RELATION')
    .sort((a, b) => Number(b.inTable ?? false) - Number(a.inTable ?? false));
}

/**
 * Counts how many concrete conditions a filter map holds, ignoring empties.
 * Used for the card's "N filter(s)" summary.
 */
function filterCount(filters: SegmentFilters): number {
  return Object.keys(filters ?? {}).length;
}

// ---------------------------------------------------------------------------
// Live record count — its own component so each card fetches independently and
// a single slow/failed count never blocks the others.
// ---------------------------------------------------------------------------

function SegmentCount({
  segment,
  projectId,
}: {
  segment: CrmSegment;
  projectId: string;
}): React.JSX.Element {
  const [state, setState] = React.useState<
    { kind: 'loading' } | { kind: 'ok'; count: number } | { kind: 'error' }
  >({ kind: 'loading' });

  React.useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    (async () => {
      try {
        const res = await countSabcrmRecordsTw(
          segment.object,
          { filters: segment.filters },
          projectId,
        );
        if (!alive) return;
        if (res.ok) setState({ kind: 'ok', count: res.data.count });
        else setState({ kind: 'error' });
      } catch {
        if (alive) setState({ kind: 'error' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [segment.object, segment.filters, projectId]);

  if (state.kind === 'loading') {
    return <span className="st-seg-count st-seg-count--loading" aria-hidden="true" />;
  }
  if (state.kind === 'error') {
    return (
      <span className="st-seg-count" title="Live count unavailable">
        <span className="st-seg-count__num">—</span> records
      </span>
    );
  }
  return (
    <span className="st-seg-count">
      <span className="st-seg-count__num">{state.count.toLocaleString()}</span>{' '}
      record{state.count === 1 ? '' : 's'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Segment dialog — create or edit. Name + object select + color + a small
// field=value filter builder.
// ---------------------------------------------------------------------------

interface BuilderRow {
  /** Local key for React list stability. */
  uid: string;
  field: string;
  op: 'eq' | 'contains';
  value: string;
}

let uidSeq = 0;
function nextUid(): string {
  uidSeq += 1;
  return `r${uidSeq}`;
}

/** Explodes a stored filter map into editable builder rows. */
function rowsFromFilters(filters: SegmentFilters): BuilderRow[] {
  const rows: BuilderRow[] = [];
  for (const [field, cond] of Object.entries(filters ?? {})) {
    if (typeof cond === 'string') {
      rows.push({ uid: nextUid(), field, op: 'eq', value: cond });
    } else if (cond && typeof cond === 'object') {
      rows.push({
        uid: nextUid(),
        field,
        op: cond.op === 'contains' ? 'contains' : 'eq',
        value: String(cond.value ?? ''),
      });
    }
  }
  return rows;
}

/** Collapses builder rows back into the engine's flat filter map. */
function filtersFromRows(rows: BuilderRow[]): SegmentFilters {
  const out: SegmentFilters = {};
  for (const r of rows) {
    const field = r.field.trim();
    const value = r.value.trim();
    if (!field || !value) continue;
    out[field] = { op: r.op, value };
  }
  return out;
}

interface SegmentDialogProps {
  projectId: string;
  objects: ObjectMetadata[];
  /** Present → edit mode. */
  initial?: CrmSegment;
  onClose: () => void;
  onSaved: (segment: CrmSegment) => void;
}

function SegmentDialog({
  projectId,
  objects,
  initial,
  onClose,
  onSaved,
}: SegmentDialogProps): React.JSX.Element {
  const isEdit = Boolean(initial);

  const [name, setName] = React.useState(initial?.name ?? '');
  const [object, setObject] = React.useState(
    initial?.object ?? objects[0]?.slug ?? '',
  );
  const [color, setColor] = React.useState(initial?.color ?? DEFAULT_COLOR);
  const [rows, setRows] = React.useState<BuilderRow[]>(() =>
    initial ? rowsFromFilters(initial.filters) : [],
  );

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fields = React.useMemo(
    () => builderFields(object, objects),
    [object, objects],
  );

  // Switching object invalidates field selections; reset rows to a clean slate.
  const handleObjectChange = React.useCallback((slug: string) => {
    setObject(slug);
    setRows([]);
  }, []);

  const addRow = React.useCallback(() => {
    setRows((prev) => [
      ...prev,
      { uid: nextUid(), field: '', op: 'eq', value: '' },
    ]);
  }, []);

  const updateRow = React.useCallback(
    (uid: string, patch: Partial<BuilderRow>) => {
      setRows((prev) =>
        prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const removeRow = React.useCallback((uid: string) => {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
  }, []);

  const submit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      const trimmed = name.trim();
      if (!trimmed) {
        setError('A segment name is required.');
        return;
      }
      if (!object) {
        setError('Choose an object for this segment.');
        return;
      }
      setSubmitting(true);
      setError(null);
      const input: SegmentInput = {
        name: trimmed,
        object,
        filters: filtersFromRows(rows),
        color,
      };
      try {
        const res = isEdit
          ? await updateSegmentTw(initial!.id, input, projectId)
          : await createSegmentTw(input, projectId);
        if (res.ok) {
          onSaved(res.data as CrmSegment);
        } else {
          setError(res.error);
        }
      } catch {
        setError('Failed to save the segment. The service may be unavailable.');
      } finally {
        setSubmitting(false);
      }
    },
    [name, object, rows, color, isEdit, initial, projectId, submitting, onSaved],
  );

  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit segment' : 'New segment'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="st-dialog" style={{ maxWidth: 520 }}>
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">
            {isEdit ? 'Edit segment' : 'New segment'}
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

        <form onSubmit={submit}>
          <div className="st-dialog__body">
            <div className="st-field">
              <label className="st-field__label" htmlFor="seg-name">
                Name
                <span className="st-field__req" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="seg-name"
                className="st-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Active enterprise deals"
                autoFocus
              />
            </div>

            <div className="st-field">
              <label className="st-field__label" htmlFor="seg-object">
                Object
                <span className="st-field__req" aria-hidden="true">
                  *
                </span>
              </label>
              <select
                id="seg-object"
                className="st-select"
                value={object}
                onChange={(e) => handleObjectChange(e.target.value)}
                disabled={isEdit || objects.length === 0}
              >
                {objects.length === 0 ? (
                  <option value="">No objects available</option>
                ) : (
                  objects.map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {o.labelPlural}
                    </option>
                  ))
                )}
              </select>
              {isEdit ? (
                <p className="st-muted st-seg-hint">
                  An existing segment&apos;s object can&apos;t be changed.
                </p>
              ) : null}
            </div>

            <div className="st-field">
              <span className="st-field__label">Color</span>
              <div className="st-seg-swatches" role="radiogroup" aria-label="Segment color">
                {SEGMENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={color === c.value}
                    aria-label={c.label}
                    title={c.label}
                    className={
                      'st-seg-swatch' +
                      (color === c.value ? ' st-seg-swatch--active' : '')
                    }
                    style={{ background: c.value }}
                    onClick={() => setColor(c.value)}
                  />
                ))}
              </div>
            </div>

            <div className="st-field">
              <span className="st-field__label">Filters</span>
              <p className="st-muted st-seg-hint">
                All conditions must match. Leave empty to include every record.
              </p>

              {rows.length === 0 ? (
                <div className="st-seg-builder-empty">No conditions yet.</div>
              ) : (
                <div className="st-seg-builder">
                  {rows.map((row) => (
                    <div key={row.uid} className="st-seg-cond">
                      <select
                        className="st-select st-seg-cond__field"
                        value={row.field}
                        aria-label="Field"
                        onChange={(e) =>
                          updateRow(row.uid, { field: e.target.value })
                        }
                      >
                        <option value="">Field…</option>
                        {fields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="st-select st-seg-cond__op"
                        value={row.op}
                        aria-label="Operator"
                        onChange={(e) =>
                          updateRow(row.uid, {
                            op: e.target.value === 'contains' ? 'contains' : 'eq',
                          })
                        }
                      >
                        <option value="eq">is</option>
                        <option value="contains">contains</option>
                      </select>
                      <input
                        className="st-input st-seg-cond__val"
                        type="text"
                        value={row.value}
                        aria-label="Value"
                        placeholder="Value"
                        onChange={(e) =>
                          updateRow(row.uid, { value: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        className="st-seg-cond__remove"
                        aria-label="Remove condition"
                        title="Remove condition"
                        onClick={() => removeRow(row.uid)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="st-seg-builder-add">
                <TwentyButton
                  variant="ghost"
                  icon={Plus}
                  onClick={addRow}
                  disabled={fields.length === 0}
                >
                  Add condition
                </TwentyButton>
              </div>
            </div>

            {error ? <p className="st-form-error">{error}</p> : null}
          </div>

          <div className="st-dialog__footer">
            <TwentyButton variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </TwentyButton>
            <TwentyButton type="submit" variant="primary" disabled={submitting}>
              {submitting
                ? 'Saving…'
                : isEdit
                  ? 'Save changes'
                  : 'Create segment'}
            </TwentyButton>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

function DeleteSegmentDialog({
  segment,
  busy,
  onCancel,
  onConfirm,
}: {
  segment: CrmSegment;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Delete segment"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="st-dialog">
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Delete segment</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">
          <p style={{ margin: 0, color: 'var(--st-text-secondary)' }}>
            Delete the segment{' '}
            <strong style={{ color: 'var(--st-text)' }}>{segment.name}</strong>?
            Its records are not affected — only the saved smart list is removed.
            This cannot be undone.
          </p>
        </div>
        <div className="st-dialog__footer">
          <TwentyButton variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </TwentyButton>
          <TwentyButton
            variant="secondary"
            className="st-btn--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Deleting…' : 'Delete segment'}
          </TwentyButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid skeleton
// ---------------------------------------------------------------------------

function GridSkeleton({ count = 6 }: { count?: number }): React.JSX.Element {
  return (
    <div className="st-seg-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="st-seg-card st-seg-card--skeleton">
          <div className="st-skeleton st-seg-skel-line" style={{ width: '60%' }} />
          <div className="st-skeleton st-seg-skel-line" style={{ width: '40%' }} />
          <div className="st-skeleton st-seg-skel-line" style={{ width: '30%' }} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One segment card
// ---------------------------------------------------------------------------

function SegmentCard({
  segment,
  projectId,
  objects,
  onEdit,
  onDelete,
}: {
  segment: CrmSegment;
  projectId: string;
  objects: ObjectMetadata[];
  onEdit: (s: CrmSegment) => void;
  onDelete: (s: CrmSegment) => void;
}): React.JSX.Element {
  const href = `/sabcrm/${encodeURIComponent(segment.object)}?segment=${encodeURIComponent(segment.id)}`;
  const fc = filterCount(segment.filters);
  const dot = segment.color ?? DEFAULT_COLOR;

  return (
    <div className="st-seg-card">
      <div className="st-seg-card__top">
        <span
          className="st-seg-dot"
          style={{ background: dot }}
          aria-hidden="true"
        />
        <a className="st-seg-card__name" href={href} title={segment.name}>
          {segment.name}
        </a>
        <div className="st-seg-card__actions">
          <button
            type="button"
            className="st-seg-iconbtn"
            aria-label="Edit segment"
            title="Edit segment"
            onClick={() => onEdit(segment)}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="st-seg-iconbtn st-seg-iconbtn--danger"
            aria-label="Delete segment"
            title="Delete segment"
            onClick={() => onDelete(segment)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="st-seg-card__meta">
        <span className="st-seg-object">
          <Database size={13} aria-hidden="true" />
          {objectLabel(segment.object, objects)}
        </span>
        <span className="st-seg-sep" aria-hidden="true">
          ·
        </span>
        <span className="st-seg-filters-n">
          {fc === 0 ? 'No filters' : `${fc} filter${fc === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="st-seg-card__foot">
        <SegmentCount segment={segment} projectId={projectId} />
        <a className="st-seg-open" href={href}>
          Open
          <ArrowRight size={13} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmSegmentsSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  const [segments, setSegments] = React.useState<CrmSegment[]>([]);
  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Dialog state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<CrmSegment | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CrmSegment | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [segRes, objRes] = await Promise.all([
        listSegmentsTw(undefined),
        listSabcrmObjectsTw(projectId),
      ]);
      if (objRes.ok) setObjects(objRes.data);
      if (segRes.ok) {
        setSegments(segRes.data as CrmSegment[]);
      } else {
        setError(segRes.error);
      }
    } catch {
      setError('Segments could not be loaded. The service may be unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setLoading(false);
      return;
    }
    void load(activeProjectId);
  }, [activeProjectId, isLoadingProject, load]);

  // ----- Mutations -----

  const handleCreated = React.useCallback((segment: CrmSegment) => {
    setSegments((prev) => [
      segment,
      ...prev.filter((s) => s.id !== segment.id),
    ]);
    setCreateOpen(false);
  }, []);

  const handleUpdated = React.useCallback((segment: CrmSegment) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segment.id ? segment : s)),
    );
    setEditTarget(null);
  }, []);

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteSegmentTw(deleteTarget.id, activeProjectId ?? undefined);
      if (res.ok) {
        setSegments((prev) => prev.filter((s) => s.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        setError(res.error);
        setDeleteTarget(null);
      }
    } catch {
      setError('Failed to delete the segment. The service may be unavailable.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, activeProjectId]);

  const canCreate = Boolean(activeProjectId) && objects.length > 0;

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader
          title="Segments"
          icon={ListFilter}
          actions={
            activeProjectId ? (
              <TwentyButton
                variant="primary"
                icon={Plus}
                onClick={() => setCreateOpen(true)}
                disabled={!canCreate}
                title={
                  canCreate
                    ? undefined
                    : 'Objects are still loading or unavailable'
                }
              >
                New segment
              </TwentyButton>
            ) : null
          }
        />
        <p className="st-settings__intro">
          Segments are saved smart lists — a named, filtered, color-coded view of
          one object. Each card shows its live record count and opens the object
          pre-filtered. Manage your segments below.
        </p>

        {isLoadingProject || loading ? (
          <GridSkeleton />
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">
              Select a project to view its segments.
            </p>
          </div>
        ) : error ? (
          <div className="st-banner">
            <AlertTriangle className="st-banner__icon" size={16} />
            <span>{error}</span>
          </div>
        ) : segments.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <ListFilter size={20} />
            </span>
            <h2 className="st-empty__title">No segments yet</h2>
            <p className="st-empty__desc">
              Create a segment to save a filtered, color-coded smart list of any
              object.
            </p>
            <div className="st-seg-empty-cta">
              <TwentyButton
                variant="primary"
                icon={Plus}
                onClick={() => setCreateOpen(true)}
                disabled={!canCreate}
              >
                New segment
              </TwentyButton>
            </div>
          </div>
        ) : (
          <>
            <div className="st-seg-grid">
              {segments.map((segment) => (
                <SegmentCard
                  key={segment.id}
                  segment={segment}
                  projectId={activeProjectId}
                  objects={objects}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
            <p className="st-footnote">
              {segments.length} segment{segments.length !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>

      {createOpen && activeProjectId ? (
        <SegmentDialog
          projectId={activeProjectId}
          objects={objects}
          onClose={() => setCreateOpen(false)}
          onSaved={handleCreated}
        />
      ) : null}

      {editTarget && activeProjectId ? (
        <SegmentDialog
          projectId={activeProjectId}
          objects={objects}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleUpdated}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteSegmentDialog
          segment={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
