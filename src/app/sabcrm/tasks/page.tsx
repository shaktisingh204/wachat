'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — top-level "Tasks" surface (`/sabcrm/tasks`), Twenty-faithful.
 *
 * A standalone screen over the standard `tasks` object, rendered in Twenty's
 * visual language (`.st-*` classes + the `@/components/sabcrm/twenty` kit + the
 * sibling `../tasks-notes.css` — NO ZoruUI / Tailwind / clay). It offers:
 *
 *   - BOARD view — kanban columns grouped by the `status` SELECT
 *     (TODO / IN_PROGRESS / DONE) via `groupSabcrmRecordsTw('tasks','status')`.
 *     Each card links to `/sabcrm/tasks/{id}`, shows the due date
 *     (`TwentyFieldValue`), the assignee as a chip, and an inline status
 *     `<select>` that persists through `updateSabcrmRecordTw`.
 *   - TABLE view — the same tasks as rows, toggled from the toolbar.
 *   - A Twenty-style "New task" dialog (title / status / dueAt / assignee /
 *     body) backed by `createSabcrmRecordTw`.
 *
 * Every data call is a gated server action returning an `ActionResult`. The
 * Rust engine may be DOWN, so failures degrade to inline banners / empty
 * states — the page never crashes.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Table2,
  Columns3,
  CalendarClock,
  User as UserIcon,
  X,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton, TwentyChip } from '@/components/sabcrm/twenty';
import { TwentyFieldValue } from '@/components/sabcrm/twenty/twenty-field';
import { useProject } from '@/context/project-context';
import {
  listSabcrmRecordsTw,
  groupSabcrmRecordsTw,
  createSabcrmRecordTw,
  updateSabcrmRecordTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type {
  SabcrmRustRecord,
  SabcrmRecordTwGroup,
} from '@/app/actions/sabcrm-twenty.actions.types';
import type { FieldMetadata } from '@/lib/sabcrm/types';

import '@/styles/sabcrm-twenty.css';
import '../tasks-notes.css';

// ---------------------------------------------------------------------------
// Constants / metadata
// ---------------------------------------------------------------------------

/** The standard `tasks` object slug this page surfaces. */
const TASKS_OBJECT = 'tasks';

const PAGE_LIMIT = 100;

type ViewKind = 'board' | 'table';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

/** The status SELECT options, in board column order. */
const STATUS_OPTIONS: ReadonlyArray<{ value: TaskStatus; label: string; color: string }> = [
  { value: 'TODO', label: 'To do', color: 'var(--st-text-tertiary)' },
  { value: 'IN_PROGRESS', label: 'In progress', color: 'var(--st-accent)' },
  { value: 'DONE', label: 'Done', color: 'var(--stn-success, #16a34a)' },
];

const STATUS_VALUES: readonly TaskStatus[] = STATUS_OPTIONS.map((o) => o.value);

/** A synthetic SELECT field so `TwentyFieldValue` can render status chips. */
const STATUS_FIELD: FieldMetadata = {
  key: 'status',
  label: 'Status',
  type: 'SELECT',
  options: STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label, color: o.color })),
};

/** A synthetic DATE field so the card due-date renders Twenty-style. */
const DUE_FIELD: FieldMetadata = {
  key: 'dueAt',
  label: 'Due',
  type: 'DATE',
};

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (STATUS_VALUES as readonly string[]).includes(value);
}

function statusOf(record: SabcrmRustRecord): TaskStatus {
  const raw = record.data.status;
  return isTaskStatus(raw) ? raw : 'TODO';
}

function statusLabel(value: string | null): string {
  if (value === null) return 'No status';
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function statusColor(value: string | null): string | undefined {
  if (value === null) return undefined;
  return STATUS_OPTIONS.find((o) => o.value === value)?.color;
}

function taskTitle(record: SabcrmRustRecord): string {
  return asText(record.data.title).trim() || 'Untitled task';
}

/** Pull a human label out of an assignee value (id, {name}, {label}…). */
function assigneeLabel(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const candidate = rec.name ?? rec.label ?? rec.title ?? rec.email;
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Inline status select (shared by board card + table row)
// ---------------------------------------------------------------------------

interface StatusSelectProps {
  value: TaskStatus;
  busy: boolean;
  onChange: (next: TaskStatus) => void;
}

function StatusSelect({ value, busy, onChange }: StatusSelectProps) {
  return (
    <select
      className="stn-status-select"
      value={value}
      disabled={busy}
      aria-label="Task status"
      onClick={(e) => {
        // Inside a card <Link>, don't navigate when toggling status.
        e.stopPropagation();
        e.preventDefault();
      }}
      onChange={(e) => {
        const next = e.target.value;
        if (isTaskStatus(next) && next !== value) onChange(next);
      }}
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Board view
// ---------------------------------------------------------------------------

interface BoardViewProps {
  groups: SabcrmRecordTwGroup[];
  busyIds: ReadonlySet<string>;
  onStatusChange: (record: SabcrmRustRecord, next: TaskStatus) => void;
}

/** Order groups as TODO → IN_PROGRESS → DONE, with any extras appended. */
function orderedGroups(groups: SabcrmRecordTwGroup[]): SabcrmRecordTwGroup[] {
  const byValue = new Map(groups.map((g) => [g.value, g]));
  const ordered: SabcrmRecordTwGroup[] = STATUS_OPTIONS.map(
    (o) => byValue.get(o.value) ?? { value: o.value, records: [] },
  );
  // Append any unexpected buckets (legacy / null) the engine returned.
  for (const g of groups) {
    if (!STATUS_VALUES.includes(g.value as TaskStatus)) ordered.push(g);
  }
  return ordered;
}

function TaskCard({
  record,
  busy,
  onStatusChange,
}: {
  record: SabcrmRustRecord;
  busy: boolean;
  onStatusChange: (next: TaskStatus) => void;
}) {
  const assignee = assigneeLabel(record.data.assignee ?? record.data.assigneeId);
  const due = record.data.dueAt;
  const hasDue = due !== null && due !== undefined && due !== '';

  return (
    <div className="st-card stn-board-card">
      <Link href={`/sabcrm/tasks/${record.id}`} className="stn-card-title">
        {taskTitle(record)}
      </Link>

      {hasDue ? (
        <div className="stn-card-meta">
          <span className="stn-card-meta__label">
            <CalendarClock size={13} aria-hidden="true" />
          </span>
          <TwentyFieldValue field={DUE_FIELD} value={due} />
        </div>
      ) : null}

      <div className="stn-card-foot">
        {assignee ? (
          <TwentyChip label={assignee} />
        ) : (
          <span className="stn-card-meta__label">
            <UserIcon size={13} aria-hidden="true" />
            Unassigned
          </span>
        )}
        <span className="stn-card-foot__status">
          {busy ? (
            <span className="stn-card-busy">
              <Loader2 size={13} className="st-spin" />
            </span>
          ) : null}
          <StatusSelect value={statusOf(record)} busy={busy} onChange={onStatusChange} />
        </span>
      </div>
    </div>
  );
}

function BoardView({ groups, busyIds, onStatusChange }: BoardViewProps) {
  return (
    <div className="st-board">
      {orderedGroups(groups).map((group) => (
        <div className="st-board__col" key={group.value ?? '__ungrouped__'}>
          <div className="st-board__head">
            <TwentyChip label={statusLabel(group.value)} color={statusColor(group.value)} />
            <span className="st-board__count">{group.records.length}</span>
          </div>
          <div className="st-board__body">
            {group.records.length === 0 ? (
              <div className="st-board__empty">Nothing here</div>
            ) : (
              group.records.map((record) => (
                <TaskCard
                  key={record.id}
                  record={record}
                  busy={busyIds.has(record.id)}
                  onStatusChange={(next) => onStatusChange(record, next)}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------

interface TableViewProps {
  records: SabcrmRustRecord[];
  busyIds: ReadonlySet<string>;
  onStatusChange: (record: SabcrmRustRecord, next: TaskStatus) => void;
}

function TableView({ records, busyIds, onStatusChange }: TableViewProps) {
  return (
    <div className="st-table-wrap">
      <table className="st-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Status</th>
            <th>Due</th>
            <th>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const assignee = assigneeLabel(record.data.assignee ?? record.data.assigneeId);
            const due = record.data.dueAt;
            const busy = busyIds.has(record.id);
            return (
              <tr key={record.id} className="st-row">
                <td>
                  <Link href={`/sabcrm/tasks/${record.id}`} className="st-cell-link">
                    {taskTitle(record)}
                  </Link>
                </td>
                <td>
                  <span className="stn-card-foot__status">
                    {busy ? (
                      <span className="stn-card-busy">
                        <Loader2 size={13} className="st-spin" />
                      </span>
                    ) : null}
                    <StatusSelect
                      value={statusOf(record)}
                      busy={busy}
                      onChange={(next) => onStatusChange(record, next)}
                    />
                  </span>
                </td>
                <td>
                  <TwentyFieldValue field={DUE_FIELD} value={due} />
                </td>
                <td>
                  {assignee ? (
                    <TwentyChip label={assignee} />
                  ) : (
                    <span className="st-cell-muted">Unassigned</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create dialog
// ---------------------------------------------------------------------------

interface CreateDialogProps {
  projectId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

function CreateDialog({ projectId, onClose, onCreated }: CreateDialogProps) {
  const [title, setTitle] = React.useState('');
  const [status, setStatus] = React.useState<TaskStatus>('TODO');
  const [dueAt, setDueAt] = React.useState('');
  const [assignee, setAssignee] = React.useState('');
  const [body, setBody] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    if (!title.trim()) {
      setError('A title is required.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = { title: title.trim(), status };
    if (dueAt) payload.dueAt = dueAt;
    if (assignee.trim()) payload.assignee = assignee.trim();
    if (body.trim()) payload.body = body.trim();

    const res = await createSabcrmRecordTw(TASKS_OBJECT, payload, projectId ?? undefined);
    setSaving(false);
    if (res.ok) {
      onCreated();
      onClose();
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
        aria-label="New task"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="st-dialog__header">
            <h2 className="st-dialog__title">New task</h2>
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
                Title<span className="st-field__req">*</span>
              </span>
              <input
                className="st-input"
                value={title}
                required
                autoFocus
                placeholder="What needs doing?"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="st-field">
              <span className="st-field__label">Status</span>
              <select
                className="st-select"
                value={status}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isTaskStatus(v)) setStatus(v);
                }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="st-field">
              <span className="st-field__label">Due date</span>
              <input
                className="st-input"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>

            <div className="st-field">
              <span className="st-field__label">Assignee</span>
              <input
                className="st-input"
                value={assignee}
                placeholder="Who owns it?"
                onChange={(e) => setAssignee(e.target.value)}
              />
            </div>

            <div className="st-field">
              <span className="st-field__label">Notes</span>
              <textarea
                className="st-textarea"
                value={body}
                rows={3}
                placeholder="Optional details…"
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            {error ? (
              <div className="st-banner">
                <AlertTriangle className="st-banner__icon" size={15} />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <div className="st-dialog__footer">
            <TwentyButton variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </TwentyButton>
            <button type="submit" className="st-btn st-btn--primary" disabled={saving}>
              {saving ? <Loader2 size={14} className="st-spin" /> : null}
              Create task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton / error
// ---------------------------------------------------------------------------

function BoardSkeleton() {
  return (
    <div className="st-board">
      {STATUS_OPTIONS.map((o) => (
        <div className="st-board__col" key={o.value}>
          <div className="st-board__head">
            <TwentyChip label={o.label} color={o.color} />
          </div>
          <div className="st-board__body">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="st-skeleton" style={{ height: 64, borderRadius: 8 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="st-banner" role="alert">
      <AlertTriangle className="st-banner__icon" size={15} />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmTasksPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [view, setView] = React.useState<ViewKind>('board');

  const [groups, setGroups] = React.useState<SabcrmRecordTwGroup[]>([]);
  const [records, setRecords] = React.useState<SabcrmRustRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());

  // Load board groups + flat list (the table reuses the flat list).
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      if (view === 'board') {
        const res = await groupSabcrmRecordsTw(
          TASKS_OBJECT,
          'status',
          activeProjectId ?? undefined,
        );
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          setGroups([]);
        } else {
          setGroups(res.data.groups);
        }
      } else {
        const res = await listSabcrmRecordsTw(
          TASKS_OBJECT,
          { limit: PAGE_LIMIT, sortBy: 'updatedAt', sortDir: 'desc' },
          activeProjectId ?? undefined,
        );
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          setRecords([]);
        } else {
          setRecords(res.data.records);
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [view, activeProjectId, refreshTick]);

  const refresh = React.useCallback(() => setRefreshTick((t) => t + 1), []);

  // Inline status change → optimistic update + persist via the Rust engine.
  const handleStatusChange = React.useCallback(
    async (record: SabcrmRustRecord, next: TaskStatus) => {
      if (busyIds.has(record.id)) return;
      setBusyIds((b) => new Set(b).add(record.id));

      // Optimistic patch for both projections.
      const patch = (r: SabcrmRustRecord) =>
        r.id === record.id ? { ...r, data: { ...r.data, status: next } } : r;
      setRecords((rs) => rs.map(patch));
      setGroups((gs) => {
        // Move the record between status columns optimistically.
        const stripped = gs.map((g) => ({
          ...g,
          records: g.records.filter((r) => r.id !== record.id),
        }));
        const moved = { ...record, data: { ...record.data, status: next } };
        const target = stripped.find((g) => g.value === next);
        if (target) {
          target.records = [moved, ...target.records];
          return stripped;
        }
        return [...stripped, { value: next, records: [moved] }];
      });

      const res = await updateSabcrmRecordTw(
        TASKS_OBJECT,
        record.id,
        { status: next },
        activeProjectId ?? undefined,
      );

      setBusyIds((b) => {
        const n = new Set(b);
        n.delete(record.id);
        return n;
      });

      if (!res.ok) {
        setError(res.error);
        // Re-sync from the server to undo the optimistic move.
        refresh();
      }
    },
    [busyIds, activeProjectId, refresh],
  );

  const handleCreated = React.useCallback(() => refresh(), [refresh]);

  const totalCount =
    view === 'board'
      ? groups.reduce((sum, g) => sum + g.records.length, 0)
      : records.length;

  const isEmpty = !loading && totalCount === 0;

  return (
    <div className="st-page">
      <TwentyPageHeader
        title="Tasks"
        icon={CheckCircle2}
        actions={
          <TwentyButton variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            New task
          </TwentyButton>
        }
      />

      <div className="st-toolbar">
        <div className="st-toolbar__spacer" />
        {!loading ? (
          <span className="st-count">
            {totalCount} {totalCount === 1 ? 'task' : 'tasks'}
          </span>
        ) : null}
        <div className="st-viewswitch" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'board'}
            className={`st-viewswitch__btn${view === 'board' ? ' active' : ''}`}
            onClick={() => setView('board')}
          >
            <Columns3 size={14} aria-hidden="true" />
            Board
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'table'}
            className={`st-viewswitch__btn${view === 'table' ? ' active' : ''}`}
            onClick={() => setView('table')}
          >
            <Table2 size={14} aria-hidden="true" />
            Table
          </button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <BoardSkeleton />
      ) : isEmpty ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <CheckCircle2 size={20} />
          </span>
          <h2 className="st-empty__title">No tasks yet</h2>
          <p className="st-empty__desc">
            Create your first task to start tracking work across To do, In
            progress and Done.
          </p>
          <TwentyButton variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            New task
          </TwentyButton>
        </div>
      ) : view === 'board' ? (
        <BoardView
          groups={groups}
          busyIds={busyIds}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <TableView
          records={records}
          busyIds={busyIds}
          onStatusChange={handleStatusChange}
        />
      )}

      {createOpen ? (
        <CreateDialog
          projectId={activeProjectId}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      ) : null}
    </div>
  );
}
