'use client';

/**
 * SabCRM — Twenty-faithful record DETAIL (client runtime).
 *
 * Renders one record in Twenty's record-page layout (NO ZoruUI; `.st-*` /
 * `.rt-*` classes + the twenty kit only):
 *   - a header with the object icon + the record's label value + favorite star,
 *   - a back link to the index,
 *   - a left/main panel: the field list as label→value rows, each value inline-
 *     editable and persisted through `updateSabcrmRecordTw` (optimistic),
 *   - a right rail with a Twenty tab strip (Fields / Notes / Tasks / Activity):
 *       · Fields   — compact read-only summary of the same record fields,
 *       · Notes    — NOTE-kind activities + a note composer,
 *       · Tasks    — TASK-kind activities (status chip, due) + add-task composer,
 *                    status toggled via `updateSabcrmActivityTw`,
 *       · Activity — the full TwentyTimeline + the multi-kind composer.
 *   - a Relations area below the grid: one Twenty "relation section" per related
 *     object returned by `getRecordRelationsTw`, each a compact list of related
 *     records linking to their own detail pages.
 *
 * The server page hands in already-gated initial data. Edits call the gated
 * action; a failure rolls the value back and shows an inline error banner. Every
 * async load (timeline, favorites, relations) degrades gracefully — the Rust
 * engine may be down, so this never crashes (empty / muted states instead).
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  Building2,
  Users,
  Briefcase,
  StickyNote,
  CheckCircle2,
  Circle,
  Database,
  Star,
  Plus,
  Loader2,
  CalendarClock,
  ChevronRight,
  Link2,
  Activity,
  type LucideIcon,
} from 'lucide-react';

import { TwentyChip } from '@/components/sabcrm/twenty/twenty-primitives';
import { TwentyFieldValue } from '@/components/sabcrm/twenty/twenty-field';
import {
  TwentyTimeline,
  type TimelineItem,
} from '@/components/sabcrm/twenty/twenty-timeline';
import '@/components/sabcrm/twenty/twenty-activity.css';
import {
  updateSabcrmRecordTw,
  listSabcrmActivitiesTw,
  createSabcrmActivityTw,
  updateSabcrmActivityTw,
  listSabcrmFavoritesTw,
  addSabcrmFavoriteTw,
  removeSabcrmFavoriteTw,
  // In-flight: added in parallel by another agent. If tsc flags ONLY this
  // import as missing during the port, that's the expected interim state.
  getRecordRelationsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type {
  SabcrmRustRecord,
  SabcrmRustActivity,
  SabcrmActivityKind,
  RecordRelation,
} from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';

import './record-tabs.css';

/** Map a known object slug to a Twenty sidebar icon (best-effort). */
const SLUG_ICON: Record<string, LucideIcon> = {
  companies: Building2,
  people: Users,
  opportunities: Briefcase,
  notes: StickyNote,
  tasks: CheckCircle2,
};

const INLINE_EDITABLE: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>(['TEXT', 'EMAIL', 'PHONE', 'LINK', 'NUMBER', 'CURRENCY', 'RATING', 'SELECT']);

function recordLabel(object: ObjectMetadata, record: SabcrmRustRecord): string {
  const field =
    object.fields.find((f) => f.isLabel) ??
    object.fields.find((f) => f.type === 'TEXT' || f.type === 'EMAIL') ??
    object.fields[0];
  if (field) {
    const raw = record.data[field.key];
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  }
  return `${object.labelSingular} ${record.id.slice(-6)}`;
}

function coerceInput(field: FieldMetadata, raw: string): unknown {
  if (raw === '') return '';
  if (field.type === 'NUMBER' || field.type === 'CURRENCY' || field.type === 'RATING') {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Activity timeline helpers
// ---------------------------------------------------------------------------

/** The activity kinds the composer offers. */
const ACTIVITY_KINDS: readonly { value: SabcrmActivityKind; label: string }[] = [
  { value: 'NOTE', label: 'Note' },
  { value: 'TASK', label: 'Task' },
  { value: 'CALL', label: 'Call' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'EMAIL', label: 'Email' },
] as const;

/** Map a raw engine activity to the presentational timeline item. */
function activityToItem(a: SabcrmRustActivity): TimelineItem {
  return {
    id: a.id,
    type: a.type,
    title: a.title,
    body: a.body || undefined,
    createdAt: a.createdAt,
    authorName: a.authorId || undefined,
  };
}

/** True when a TASK activity is in its completed state. */
function isTaskDone(a: SabcrmRustActivity): boolean {
  return (a.status ?? '').toUpperCase() === 'DONE';
}

/** Compact relative time for note/task heads ("5m ago", else a short date). */
function relTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const MIN = 60_000;
  const HR = 60 * MIN;
  const DAY = 24 * HR;
  if (diff < MIN) return 'just now';
  if (diff < HR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Humanize a due date for the task meta row. */
function formatDue(value: string): string | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Best-effort label for a related record when only its raw `data` bag (no full
 * target-object metadata) is available: prefer a `labelField`, then common label
 * keys, then a short id suffix.
 */
function relationRecordLabel(
  record: SabcrmRustRecord,
  labelField?: string,
): string {
  const data = record.data ?? {};
  const order = [
    labelField,
    'name',
    'label',
    'title',
    'displayName',
    'fullName',
    'firstName',
  ].filter(Boolean) as string[];
  for (const key of order) {
    const raw = data[key];
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (typeof raw === 'number') return String(raw);
  }
  // Compose a name from first/last if present.
  const first = data.firstName;
  const last = data.lastName;
  if (typeof first === 'string' || typeof last === 'string') {
    const composed = [first, last].filter(Boolean).join(' ').trim();
    if (composed) return composed;
  }
  return `#${record.id.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

interface ComposerProps {
  onAdd: (
    type: SabcrmActivityKind,
    title: string,
    body: string,
  ) => Promise<boolean>;
}

function Composer({ onAdd }: ComposerProps) {
  const [type, setType] = React.useState<SabcrmActivityKind>('NOTE');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    const ok = await onAdd(type, title.trim(), body.trim());
    setSaving(false);
    if (ok) {
      setTitle('');
      setBody('');
    } else {
      setError('Could not add activity.');
    }
  };

  return (
    <form className="st-composer" onSubmit={submit}>
      <div className="st-composer__row">
        <select
          className="st-composer__type"
          value={type}
          onChange={(e) => setType(e.target.value as SabcrmActivityKind)}
          aria-label="Activity type"
        >
          {ACTIVITY_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          className="st-composer__title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a title…"
          aria-label="Activity title"
        />
      </div>
      <textarea
        className="st-composer__body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note (optional)…"
        aria-label="Activity body"
      />
      <div className="st-composer__footer">
        {error && <span className="st-composer__error">{error}</span>}
        <button
          type="submit"
          className="st-composer__add"
          disabled={saving || !title.trim()}
        >
          {saving ? <Loader2 size={13} className="st-spin" /> : <Plus size={13} />}
          Add
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Favorite star
// ---------------------------------------------------------------------------

interface StarToggleProps {
  active: boolean;
  busy?: boolean;
  onToggle: () => void;
  className?: string;
}

function StarToggle({ active, busy, onToggle, className }: StarToggleProps) {
  return (
    <button
      type="button"
      className={`st-star${active ? ' active' : ''}${className ? ` ${className}` : ''}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      disabled={busy}
      aria-pressed={active}
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      title={active ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star size={15} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tab strip
// ---------------------------------------------------------------------------

type TabKey = 'fields' | 'notes' | 'tasks' | 'activity';

const TAB_DEFS: readonly { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'fields', label: 'Fields', icon: Database },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'tasks', label: 'Tasks', icon: CheckCircle2 },
  { key: 'activity', label: 'Activity', icon: Activity },
] as const;

interface TabStripProps {
  active: TabKey;
  onSelect: (key: TabKey) => void;
  counts: Partial<Record<TabKey, number>>;
}

function TabStrip({ active, onSelect, counts }: TabStripProps) {
  return (
    <div className="rt-tabs" role="tablist" aria-label="Record sections">
      {TAB_DEFS.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        const count = counts[key];
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`rt-tab${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect(key)}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
            {typeof count === 'number' && count > 0 ? (
              <span className="rt-tab__count">{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Note composer (NOTE-only)
// ---------------------------------------------------------------------------

interface NoteComposerProps {
  onAdd: (title: string, body: string) => Promise<boolean>;
}

function NoteComposer({ onAdd }: NoteComposerProps) {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    const ok = await onAdd(title.trim(), body.trim());
    setSaving(false);
    if (ok) {
      setTitle('');
      setBody('');
    } else {
      setError('Could not add note.');
    }
  };

  return (
    <form className="st-composer" onSubmit={submit}>
      <div className="st-composer__row">
        <input
          className="st-composer__title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title…"
          aria-label="Note title"
        />
      </div>
      <textarea
        className="st-composer__body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a note…"
        aria-label="Note body"
      />
      <div className="st-composer__footer">
        {error && <span className="st-composer__error">{error}</span>}
        <button
          type="submit"
          className="st-composer__add"
          disabled={saving || !title.trim()}
        >
          {saving ? <Loader2 size={13} className="st-spin" /> : <Plus size={13} />}
          Add note
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Task composer (TASK-only) + task list row
// ---------------------------------------------------------------------------

interface TaskComposerProps {
  onAdd: (title: string) => Promise<boolean>;
}

function TaskComposer({ onAdd }: TaskComposerProps) {
  const [title, setTitle] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    const ok = await onAdd(title.trim());
    setSaving(false);
    if (ok) setTitle('');
    else setError('Could not add task.');
  };

  return (
    <form className="st-composer" onSubmit={submit}>
      <div className="st-composer__row">
        <input
          className="st-composer__title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          aria-label="Task title"
        />
        <button
          type="submit"
          className="st-composer__add"
          disabled={saving || !title.trim()}
        >
          {saving ? <Loader2 size={13} className="st-spin" /> : <Plus size={13} />}
          Add
        </button>
      </div>
      {error && (
        <div className="st-composer__footer">
          <span className="st-composer__error">{error}</span>
        </div>
      )}
    </form>
  );
}

const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

interface TaskRowProps {
  task: SabcrmRustActivity;
  busy: boolean;
  onToggle: (task: SabcrmRustActivity) => void;
}

function TaskRow({ task, busy, onToggle }: TaskRowProps) {
  const done = isTaskDone(task);
  const due = task.dueAt ? formatDue(task.dueAt) : null;
  const statusLabel =
    TASK_STATUS_LABEL[(task.status ?? 'TODO').toUpperCase()] ??
    (task.status ?? 'To do');
  return (
    <div className="rt-task">
      <button
        type="button"
        className={`rt-task__check${done ? ' is-done' : ''}`}
        onClick={() => onToggle(task)}
        disabled={busy}
        aria-pressed={done}
        aria-label={done ? 'Mark task as not done' : 'Mark task as done'}
        title={done ? 'Mark as not done' : 'Mark as done'}
      >
        {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      </button>
      <div className="rt-task__main">
        <span className={`rt-task__title${done ? ' is-done' : ''}`}>
          {task.title}
        </span>
        <span className="rt-task__meta">
          <TwentyChip label={statusLabel} />
          {due ? (
            <span className="rt-task__due">
              <CalendarClock size={11} aria-hidden="true" />
              {due}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Relation section (one related-records group)
// ---------------------------------------------------------------------------

interface RelationSectionProps {
  relation: RecordRelation;
}

function RelationSection({ relation }: RelationSectionProps) {
  const { label, targetObject, records } = relation;
  return (
    <section className="rt-relation" aria-label={label}>
      <div className="rt-relation__head">
        <Link2 size={14} className="rt-relrow__icon" aria-hidden="true" />
        <span className="rt-relation__label">{label}</span>
        <span className="rt-relation__count">{records.length}</span>
      </div>
      {records.length === 0 ? (
        <div className="rt-relation__empty">No {label.toLowerCase()}</div>
      ) : (
        <div className="rt-relation__list">
          {records.map((rec) => (
            <Link
              key={rec.id}
              href={`/sabcrm/${targetObject}/${rec.id}`}
              className="rt-relrow"
            >
              <span className="rt-relrow__icon" aria-hidden="true">
                <Database size={13} />
              </span>
              <span className="rt-relrow__label">
                {relationRecordLabel(rec)}
              </span>
              <ChevronRight
                size={14}
                className="rt-relrow__chevron"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline-editable field value
// ---------------------------------------------------------------------------

interface EditableValueProps {
  field: FieldMetadata;
  value: unknown;
  onCommit: (value: unknown) => void;
}

function EditableValue({ field, value, onCommit }: EditableValueProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  if (!INLINE_EDITABLE.has(field.type)) {
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
      type={
        field.type === 'NUMBER' || field.type === 'CURRENCY' || field.type === 'RATING'
          ? 'number'
          : 'text'
      }
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RecordDetailTwProps {
  object: ObjectMetadata;
  record: SabcrmRustRecord;
  projectId: string | null;
}

export function RecordDetailTw({
  object,
  record: initialRecord,
  projectId,
}: RecordDetailTwProps): React.JSX.Element {
  const [record, setRecord] = React.useState<SabcrmRustRecord>(initialRecord);
  const [error, setError] = React.useState<string | null>(null);

  // Timeline state.
  const [activities, setActivities] = React.useState<SabcrmRustActivity[]>([]);
  const [loadingTimeline, setLoadingTimeline] = React.useState(true);

  // Favorite state.
  const [favorite, setFavorite] = React.useState(false);
  const [favBusy, setFavBusy] = React.useState(false);

  // Active right-rail tab.
  const [tab, setTab] = React.useState<TabKey>('activity');

  // Related-records sections (graceful: empty on failure / engine down).
  const [relations, setRelations] = React.useState<RecordRelation[]>([]);
  const [loadingRelations, setLoadingRelations] = React.useState(true);

  // Per-task in-flight guard for status toggles.
  const [taskBusyId, setTaskBusyId] = React.useState<string | null>(null);

  const ObjectIcon = SLUG_ICON[object.slug] ?? Database;
  const editableFields = React.useMemo(
    () => object.fields.filter((f) => !f.system && f.type !== 'RELATION'),
    [object],
  );

  const handleCommit = React.useCallback(
    async (key: string, value: unknown) => {
      const prev = record;
      setError(null);
      setRecord((r) => ({ ...r, data: { ...r.data, [key]: value } }));
      const res = await updateSabcrmRecordTw(
        object.slug,
        record.id,
        { [key]: value },
        projectId ?? undefined,
      );
      if (!res.ok) {
        setRecord(prev);
        setError(res.error);
      } else {
        setRecord(res.data);
      }
    },
    [record, object.slug, projectId],
  );

  // Load the record's timeline (graceful: empty on failure / engine down).
  React.useEffect(() => {
    let cancelled = false;
    setLoadingTimeline(true);
    (async () => {
      const res = await listSabcrmActivitiesTw(
        object.slug,
        record.id,
        {},
        projectId ?? undefined,
      );
      if (cancelled) return;
      if (res.ok) setActivities(res.data);
      else setActivities([]);
      setLoadingTimeline(false);
    })();
    return () => {
      cancelled = true;
    };
    // Only re-run when the record identity changes (not on every edit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.slug, record.id, projectId]);

  // Load whether this record is favorited.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listSabcrmFavoritesTw(projectId ?? undefined);
      if (cancelled) return;
      if (res.ok) {
        setFavorite(
          res.data.some(
            (f) => f.object === object.slug && f.recordId === record.id,
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [object.slug, record.id, projectId]);

  const handleAddActivity = React.useCallback(
    async (type: SabcrmActivityKind, title: string, body: string) => {
      const res = await createSabcrmActivityTw(
        {
          targetObject: object.slug,
          targetRecordId: record.id,
          type,
          title,
          body: body || undefined,
        },
        projectId ?? undefined,
      );
      if (!res.ok) return false;
      // Prepend (timeline is newest-first).
      setActivities((prev) => [res.data, ...prev]);
      return true;
    },
    [object.slug, record.id, projectId],
  );

  const handleToggleFavorite = React.useCallback(async () => {
    if (favBusy) return;
    const next = !favorite;
    setFavBusy(true);
    setFavorite(next); // optimistic
    const res = next
      ? await addSabcrmFavoriteTw(object.slug, record.id, projectId ?? undefined)
      : await removeSabcrmFavoriteTw(
          object.slug,
          record.id,
          projectId ?? undefined,
        );
    if (!res.ok) {
      setFavorite(!next); // rollback
      setError(res.error);
    }
    setFavBusy(false);
  }, [favBusy, favorite, object.slug, record.id, projectId]);

  // Load related-records sections (graceful: empty on failure / engine down).
  React.useEffect(() => {
    let cancelled = false;
    setLoadingRelations(true);
    (async () => {
      try {
        const res = await getRecordRelationsTw(
          object.slug,
          record.id,
          projectId ?? undefined,
        );
        if (cancelled) return;
        setRelations(res.ok ? res.data : []);
      } catch {
        if (!cancelled) setRelations([]);
      } finally {
        if (!cancelled) setLoadingRelations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [object.slug, record.id, projectId]);

  // Add a NOTE-kind activity (Notes tab composer).
  const handleAddNote = React.useCallback(
    (title: string, body: string) => handleAddActivity('NOTE', title, body),
    [handleAddActivity],
  );

  // Add a TASK-kind activity, defaulting status to TODO (Tasks tab composer).
  const handleAddTask = React.useCallback(
    async (title: string) => {
      const res = await createSabcrmActivityTw(
        {
          targetObject: object.slug,
          targetRecordId: record.id,
          type: 'TASK',
          title,
          status: 'TODO',
        },
        projectId ?? undefined,
      );
      if (!res.ok) return false;
      setActivities((prev) => [res.data, ...prev]);
      return true;
    },
    [object.slug, record.id, projectId],
  );

  // Toggle a task between TODO and DONE (optimistic; rolls back on failure).
  const handleToggleTask = React.useCallback(
    async (task: SabcrmRustActivity) => {
      if (taskBusyId) return;
      const nextStatus = isTaskDone(task) ? 'TODO' : 'DONE';
      setTaskBusyId(task.id);
      setActivities((prev) =>
        prev.map((a) =>
          a.id === task.id ? { ...a, status: nextStatus } : a,
        ),
      );
      const res = await updateSabcrmActivityTw(
        task.id,
        { status: nextStatus },
        projectId ?? undefined,
      );
      if (!res.ok) {
        // Roll back to the prior status.
        setActivities((prev) =>
          prev.map((a) => (a.id === task.id ? { ...a, status: task.status } : a)),
        );
        setError(res.error);
      } else {
        setActivities((prev) =>
          prev.map((a) => (a.id === task.id ? res.data : a)),
        );
      }
      setTaskBusyId(null);
    },
    [taskBusyId, projectId],
  );

  const timelineItems = React.useMemo<TimelineItem[]>(
    () => activities.map(activityToItem),
    [activities],
  );

  const notes = React.useMemo(
    () => activities.filter((a) => a.type.toUpperCase() === 'NOTE'),
    [activities],
  );
  const tasks = React.useMemo(
    () => activities.filter((a) => a.type.toUpperCase() === 'TASK'),
    [activities],
  );

  const tabCounts = React.useMemo<Partial<Record<TabKey, number>>>(
    () => ({
      fields: editableFields.length,
      notes: notes.length,
      tasks: tasks.length,
      activity: activities.length,
    }),
    [editableFields.length, notes.length, tasks.length, activities.length],
  );

  return (
    <div className="st-page">
      <Link href={`/sabcrm/${object.slug}`} className="st-back">
        <ArrowLeft size={14} />
        {object.labelPlural}
      </Link>

      <div className="st-detail-header">
        <span className="st-page-header__icon" aria-hidden="true">
          <ObjectIcon size={16} />
        </span>
        <h1 className="st-page-header__title">{recordLabel(object, record)}</h1>
        <StarToggle
          active={favorite}
          busy={favBusy}
          onToggle={handleToggleFavorite}
        />
      </div>

      {error && (
        <div className="st-banner" role="alert">
          <AlertTriangle className="st-banner__icon" size={15} />
          <span>{error}</span>
        </div>
      )}

      <div className="st-detail-grid">
        {/* Main column — field list */}
        <section className="st-panel" aria-label="Record fields">
          <div className="st-panel__head">Details</div>
          <div className="st-panel__body">
            {editableFields.map((field) => (
              <div className="st-field-row" key={field.key}>
                <span className="st-field-row__key">{field.label}</span>
                <span className="st-field-row__val">
                  <EditableValue
                    field={field}
                    value={record.data[field.key]}
                    onCommit={(v) => handleCommit(field.key, v)}
                  />
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Right rail — Twenty tab strip (Fields / Notes / Tasks / Activity) */}
        <aside className="st-panel" aria-label="Record sections">
          <div className="st-panel__body">
            <TabStrip active={tab} onSelect={setTab} counts={tabCounts} />

            {tab === 'fields' && (
              <div
                className="rt-panel"
                role="tabpanel"
                aria-label="Fields summary"
              >
                {editableFields.length === 0 ? (
                  <div className="rt-panel__empty">No fields.</div>
                ) : (
                  <div className="rt-fields">
                    {editableFields.map((field) => (
                      <div className="rt-fields__row" key={field.key}>
                        <span className="rt-fields__key">{field.label}</span>
                        <span className="rt-fields__val">
                          <TwentyFieldValue
                            field={field}
                            value={record.data[field.key]}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'notes' && (
              <div className="rt-panel" role="tabpanel" aria-label="Notes">
                <NoteComposer onAdd={handleAddNote} />
                {loadingTimeline ? (
                  <TwentyTimeline activities={[]} loading emptyLabel="" />
                ) : notes.length === 0 ? (
                  <div className="rt-panel__empty">No notes yet.</div>
                ) : (
                  <div className="rt-notes">
                    {notes.map((n) => (
                      <article className="rt-note" key={n.id}>
                        <div className="rt-note__head">
                          <span className="rt-note__title">{n.title}</span>
                          <time className="rt-note__time" dateTime={n.createdAt}>
                            {relTime(n.createdAt)}
                          </time>
                        </div>
                        {n.body ? (
                          <p className="rt-note__body">{n.body}</p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'tasks' && (
              <div className="rt-panel" role="tabpanel" aria-label="Tasks">
                <TaskComposer onAdd={handleAddTask} />
                {loadingTimeline ? (
                  <TwentyTimeline activities={[]} loading emptyLabel="" />
                ) : tasks.length === 0 ? (
                  <div className="rt-panel__empty">No tasks yet.</div>
                ) : (
                  <div className="rt-tasks">
                    {tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        busy={taskBusyId === t.id}
                        onToggle={handleToggleTask}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'activity' && (
              <div
                className="rt-panel"
                role="tabpanel"
                aria-label="Activity timeline"
              >
                <Composer onAdd={handleAddActivity} />
                <TwentyTimeline
                  activities={timelineItems}
                  loading={loadingTimeline}
                  emptyLabel="No activity yet"
                />
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Relations — Twenty's related-records sections */}
      {!loadingRelations && relations.length > 0 && (
        <div className="rt-relations" aria-label="Related records">
          {relations.map((rel) => (
            <RelationSection key={rel.field} relation={rel} />
          ))}
        </div>
      )}
    </div>
  );
}

export default RecordDetailTw;
