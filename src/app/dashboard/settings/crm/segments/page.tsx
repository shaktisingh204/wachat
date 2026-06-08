'use client';

/**
 * SabCRM - Segments (smart lists) settings (`/dashboard/settings/crm/segments`).
 *
 * A segment is a saved, named, filtered view of a single object - the "smart
 * list" concept. Each segment pins an object, a structured filter predicate, an
 * optional sort, and a display color. The page renders the segments as a card
 * grid; every card shows its color dot, name, target object, and a LIVE record
 * count fetched through `countSabcrmRecordsTw` with that segment's own filters,
 * and links to `/sabcrm/{object}?segment={id}` so the index page can open
 * pre-filtered.
 *
 * CRUD is handled by `@/app/actions/sabcrm-segments.actions`
 * (`listSegmentsTw` / `createSegmentTw` / `updateSegmentTw` / `deleteSegmentTw`),
 * each of which independently re-runs the session, project, RBAC, and plan
 * pipeline server-side, so the page fails closed. The object catalogue comes
 * from `listSabcrmObjectsTw`.
 *
 * The "New segment" dialog offers a name, an object select, a color swatch
 * picker, and a small field=value filter builder (a couple of equality
 * conditions). The same dialog edits an existing segment.
 *
 * States: skeleton while the project / data load, a "no project" notice, an
 * empty state, an error banner, and graceful degradation (counts that fail to
 * resolve simply show a dash) so the engine being unreachable never crashes the
 * page.
 *
 * Pure 20ui: every control, card, dialog, badge, and feedback surface comes from
 * `@/components/sabcrm/20ui`. The subtree is scoped with `ui20` so the
 * self-contained `--st-*` / `--u-*` tokens resolve.
 */

import * as React from 'react';
import {
  ListFilter,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Database,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  CardBody,
  Badge,
  Field,
  Input,
  Modal,
  RadioGroup,
  Radio,
  EmptyState,
  Alert,
  Skeleton,
  useToast,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

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

// ---------------------------------------------------------------------------
// Wire shapes
//
// Declared locally to keep this client page free of any `server-only` import.
// Mirror the `@/app/actions/sabcrm-segments.actions` contract:
//   segment { id, name, object, filters, sortBy?, sortDir?, color? }
// where `filters` is the engine's flat field->condition map.
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
// Color palette - a fixed swatch set so a segment always has a readable dot.
// Values are plain hex so they round-trip through the action without depending
// on theme tokens.
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
// Live record count - its own component so each card fetches independently and
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
    return <Skeleton width={72} height={14} />;
  }
  if (state.kind === 'error') {
    return (
      <span
        className="text-xs text-[var(--st-text-secondary)]"
        title="Live count unavailable"
      >
        <span className="font-semibold text-[var(--st-text)]">-</span> records
      </span>
    );
  }
  return (
    <span className="text-xs text-[var(--st-text-secondary)]">
      <span className="font-semibold text-[var(--st-text)]">
        {state.count.toLocaleString()}
      </span>{' '}
      record{state.count === 1 ? '' : 's'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Segment dialog - create or edit. Name + object select + color + a small
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
  const { toast } = useToast();

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
          toast.success(isEdit ? 'Segment updated' : 'Segment created');
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
    [name, object, rows, color, isEdit, initial, projectId, submitting, onSaved, toast],
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={isEdit ? 'Edit segment' : 'New segment'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="segment-form"
            variant="primary"
            loading={submitting}
          >
            {isEdit ? 'Save changes' : 'Create segment'}
          </Button>
        </>
      }
    >
      <form id="segment-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Active enterprise deals"
            autoFocus
          />
        </Field>

        <Field
          label="Object"
          required
          help={
            isEdit ? "An existing segment's object can't be changed." : undefined
          }
        >
          <Select
            value={object || undefined}
            onValueChange={handleObjectChange}
            disabled={isEdit || objects.length === 0}
          >
            <SelectTrigger aria-label="Object">
              <SelectValue placeholder="Select an object" />
            </SelectTrigger>
            <SelectContent>
              {objects.length === 0 ? (
                <SelectItem value="__none" disabled>
                  No objects available
                </SelectItem>
              ) : (
                objects.map((o) => (
                  <SelectItem key={o.slug} value={o.slug}>
                    {o.labelPlural}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Color">
          <RadioGroup
            value={color}
            onValueChange={setColor}
            orientation="horizontal"
            aria-label="Segment color"
            className="flex-wrap gap-3"
          >
            {SEGMENT_COLORS.map((c) => (
              <Radio
                key={c.value}
                value={c.value}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border border-[var(--st-border)]"
                      style={{ background: c.value }}
                      aria-hidden="true"
                    />
                    {c.label}
                  </span>
                }
              />
            ))}
          </RadioGroup>
        </Field>

        <Field
          label="Filters"
          help="All conditions must match. Leave empty to include every record."
        >
          <div className="flex flex-col gap-2">
            {rows.length === 0 ? (
              <p className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-sm text-[var(--st-text-secondary)]">
                No conditions yet.
              </p>
            ) : (
              rows.map((row) => (
                <div
                  key={row.uid}
                  className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2"
                >
                  <Select
                    value={row.field || undefined}
                    onValueChange={(v) => updateRow(row.uid, { field: v })}
                  >
                    <SelectTrigger aria-label="Field">
                      <SelectValue placeholder="Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={row.op}
                    onValueChange={(v) =>
                      updateRow(row.uid, {
                        op: v === 'contains' ? 'contains' : 'eq',
                      })
                    }
                  >
                    <SelectTrigger aria-label="Operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eq">is</SelectItem>
                      <SelectItem value="contains">contains</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    value={row.value}
                    aria-label="Value"
                    placeholder="Value"
                    onChange={(e) =>
                      updateRow(row.uid, { value: e.target.value })
                    }
                  />

                  <IconButton
                    label="Remove condition"
                    icon={Trash2}
                    size="sm"
                    onClick={() => removeRow(row.uid)}
                  />
                </div>
              ))
            )}

            <div>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Plus}
                onClick={addRow}
                disabled={fields.length === 0}
              >
                Add condition
              </Button>
            </div>
          </div>
        </Field>

        {error ? (
          <Alert tone="danger" title="Could not save">
            {error}
          </Alert>
        ) : null}
      </form>
    </Modal>
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
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title="Delete segment"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            Delete segment
          </Button>
        </>
      }
    >
      <p className="m-0 text-[var(--st-text-secondary)]">
        Delete the segment{' '}
        <strong className="text-[var(--st-text)]">{segment.name}</strong>? Its
        records are not affected, only the saved smart list is removed. This
        cannot be undone.
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Grid skeleton
// ---------------------------------------------------------------------------

function GridSkeleton({ count = 6 }: { count?: number }): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} padding="md">
          <CardBody className="flex flex-col gap-2.5">
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={12} />
            <Skeleton width="30%" height={12} />
          </CardBody>
        </Card>
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
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: dot }}
          aria-hidden="true"
        />
        <a
          className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--st-text)] hover:underline"
          href={href}
          title={segment.name}
        >
          {segment.name}
        </a>
        <div className="flex items-center gap-1">
          <IconButton
            label="Edit segment"
            icon={Pencil}
            size="sm"
            onClick={() => onEdit(segment)}
          />
          <IconButton
            label="Delete segment"
            icon={Trash2}
            size="sm"
            onClick={() => onDelete(segment)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          <Database size={13} aria-hidden="true" className="mr-1" />
          {objectLabel(segment.object, objects)}
        </Badge>
        <Badge tone={fc === 0 ? 'neutral' : 'accent'}>
          {fc === 0 ? 'No filters' : `${fc} filter${fc === 1 ? '' : 's'}`}
        </Badge>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-3">
        <SegmentCount segment={segment} projectId={projectId} />
        <a
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--st-accent)] hover:underline"
          href={href}
        >
          Open
          <ArrowRight size={13} aria-hidden="true" />
        </a>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmSegmentsSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

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
        toast.success('Segment deleted');
        setDeleteTarget(null);
      } else {
        setError(res.error);
        toast.error(res.error);
        setDeleteTarget(null);
      }
    } catch {
      const msg = 'Failed to delete the segment. The service may be unavailable.';
      setError(msg);
      toast.error(msg);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, activeProjectId, toast]);

  const canCreate = Boolean(activeProjectId) && objects.length > 0;

  return (
    <div className="20ui">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Segments</PageTitle>
            <PageDescription>
              Segments are saved smart lists, a named, filtered, color-coded view
              of one object. Each card shows its live record count and opens the
              object pre-filtered. Manage your segments below.
            </PageDescription>
          </PageHeaderHeading>
          {activeProjectId ? (
            <PageActions>
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => setCreateOpen(true)}
                disabled={!canCreate}
                title={
                  canCreate
                    ? undefined
                    : 'Objects are still loading or unavailable'
                }
              >
                New segment
              </Button>
            </PageActions>
          ) : null}
        </PageHeader>

        <div className="mt-6">
          {isLoadingProject || loading ? (
            <GridSkeleton />
          ) : !activeProjectId ? (
            <EmptyState
              icon={AlertTriangle}
              tone="warning"
              title="No project selected"
              description="Select a project to view its segments."
            />
          ) : error ? (
            <Alert tone="danger" title="Could not load segments">
              {error}
            </Alert>
          ) : segments.length === 0 ? (
            <EmptyState
              icon={ListFilter}
              title="No segments yet"
              description="Create a segment to save a filtered, color-coded smart list of any object."
              action={
                <Button
                  variant="primary"
                  iconLeft={Plus}
                  onClick={() => setCreateOpen(true)}
                  disabled={!canCreate}
                >
                  New segment
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              <p className="mt-4 text-xs text-[var(--st-text-secondary)]">
                {segments.length} segment{segments.length !== 1 ? 's' : ''}
              </p>
            </>
          )}
        </div>
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
