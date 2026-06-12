'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — top-level "Tasks" surface (`/sabcrm/tasks`), 20ui.
 *
 * A standalone screen over the standard `tasks` object, rendered entirely with
 * the 20ui design system (`@/components/sabcrm/20ui` primitives + the
 * `RecordBoard` composite — zero `.st-*` Twenty classes). It offers:
 *
 *   - BOARD view — a drag-and-drop kanban on `RecordBoard`, columns grouped by
 *     the `status` SELECT (TODO / IN_PROGRESS / DONE) via
 *     `groupSabcrmRecordsTw('tasks','status')`. Dragging a card to another
 *     column persists the status through `updateSabcrmRecordTw` (optimistic,
 *     reverts on failure). Cards show the title, the due date (overdue tint +
 *     tag), the assignee, and a completion checkbox; clicking a card opens
 *     `/sabcrm/tasks/{id}`. Each column header has a "+" that opens the create
 *     dialog pre-seeded with that column's status.
 *   - TABLE view — the same tasks as 20ui `Table` rows with an inline status
 *     select, toggled from the toolbar `SegmentedControl`.
 *   - A "New task" `Modal` (title / status / dueAt / assignee / body) backed
 *     by `createSabcrmRecordTw`.
 *
 * Every data call is a gated server action returning an `ActionResult`. The
 * Rust engine may be DOWN, so failures degrade to inline banners / empty
 * states — the page never crashes. Styling is token-only (`--st-*`), so dark
 * mode is automatic; page-local classes (`tk-*`) live in `./tasks.css`,
 * scoped under the 20ui roots.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  CheckCircle2,
  Table2,
  Columns3,
  CalendarClock,
  User as UserIcon,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageActions,
  Button,
  Checkbox,
  SelectField,
  Modal,
  Field,
  Input,
  Textarea,
  Alert,
  Skeleton,
  Spinner,
  SearchInput,
  SegmentedControl,
  EmptyState,
  Tag,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import {
  RecordBoard,
  type RecordBoardColumn,
} from '@/components/sabcrm/20ui/composites/record';
import type { CrmRecord } from '@/lib/sabcrm/types';
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
import { rustRecordToCrm } from '../[objectSlug]/record-surface-adapter';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './tasks.css';

// ---------------------------------------------------------------------------
// Constants / metadata
// ---------------------------------------------------------------------------

/** The standard `tasks` object slug this page surfaces. */
const TASKS_OBJECT = 'tasks';

const PAGE_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 250;

type ViewKind = 'board' | 'table';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

/** The status SELECT options, in board column order. Token colors only. */
const STATUS_OPTIONS: ReadonlyArray<{ value: TaskStatus; label: string; color: string }> = [
  { value: 'TODO', label: 'To do', color: 'var(--st-text-tertiary)' },
  { value: 'IN_PROGRESS', label: 'In progress', color: 'var(--st-accent)' },
  { value: 'DONE', label: 'Done', color: 'var(--st-success)' },
];

const STATUS_VALUES: readonly TaskStatus[] = STATUS_OPTIONS.map((o) => o.value);

const STATUS_SELECT_OPTIONS = STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

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

/** Format a due-date value for display (e.g. "11 Jun 2026"). */
function formatDue(value: unknown): string | null {
  const raw = asText(value);
  if (!raw) return null;
  const time = new Date(raw).getTime();
  if (Number.isNaN(time)) return raw;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(time);
}

/** True when a task's due date is in the past and the task isn't DONE. */
function isOverdue(record: SabcrmRustRecord): boolean {
  const raw = record.data.dueAt;
  if (raw === null || raw === undefined || raw === '') return false;
  if (statusOf(record) === 'DONE') return false;
  const due = new Date(asText(raw)).getTime();
  if (Number.isNaN(due)) return false;
  return due < Date.now();
}

// ---------------------------------------------------------------------------
// Completion checkbox (board card + table row — toggles DONE ⇄ TODO)
// ---------------------------------------------------------------------------

interface CompleteCheckboxProps {
  done: boolean;
  busy: boolean;
  onToggle: () => void;
}

function CompleteCheckbox({ done, busy, onToggle }: CompleteCheckboxProps) {
  return (
    <Checkbox
      size="sm"
      checked={done}
      disabled={busy}
      aria-label={done ? 'Mark task as to do' : 'Mark task as done'}
      onClick={(e) => {
        // Inside a clickable board card / table row, don't open the record
        // when toggling completion.
        e.stopPropagation();
      }}
      onChange={() => {
        if (!busy) onToggle();
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Inline status select (table rows)
// ---------------------------------------------------------------------------

interface StatusSelectProps {
  value: TaskStatus;
  busy: boolean;
  onChange: (next: TaskStatus) => void;
}

function StatusSelect({ value, busy, onChange }: StatusSelectProps) {
  return (
    <SelectField
      size="sm"
      value={value}
      disabled={busy}
      aria-label="Task status"
      options={STATUS_SELECT_OPTIONS}
      onChange={(next) => {
        if (isTaskStatus(next) && next !== value) onChange(next);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Board card content (rendered inside RecordBoard's `.rb-card` chrome)
// ---------------------------------------------------------------------------

function TaskCardContent({
  record,
  busy,
  onToggleComplete,
}: {
  record: SabcrmRustRecord;
  busy: boolean;
  onToggleComplete: () => void;
}) {
  const assignee = assigneeLabel(record.data.assignee ?? record.data.assigneeId);
  const due = formatDue(record.data.dueAt);
  const done = statusOf(record) === 'DONE';
  const overdue = isOverdue(record);

  return (
    <div className="tk-card">
      <div className="tk-card__head">
        <CompleteCheckbox done={done} busy={busy} onToggle={onToggleComplete} />
        <span className={`tk-card__title${done ? ' is-done' : ''}`}>{taskTitle(record)}</span>
      </div>

      {due ? (
        <div className={`tk-meta${overdue ? ' is-overdue' : ''}`}>
          <CalendarClock size={13} aria-hidden="true" />
          <span>{due}</span>
          {overdue ? <span className="tk-overdue-tag">Overdue</span> : null}
        </div>
      ) : null}

      <div className="tk-card__foot">
        {assignee ? (
          <Tag>{assignee}</Tag>
        ) : (
          <span className="tk-meta">
            <UserIcon size={13} aria-hidden="true" />
            Unassigned
          </span>
        )}
        {busy ? (
          <span className="tk-busy">
            <Spinner size="sm" label="Saving" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------

interface TableViewProps {
  records: SabcrmRustRecord[];
  busyIds: ReadonlySet<string>;
  onOpen: (id: string) => void;
  onStatusChange: (record: SabcrmRustRecord, next: TaskStatus) => void;
  onToggleComplete: (record: SabcrmRustRecord) => void;
}

function TableView({ records, busyIds, onOpen, onStatusChange, onToggleComplete }: TableViewProps) {
  return (
    <div className="tk-table-wrap">
      <Table>
        <THead>
          <Tr>
            <Th aria-label="Done" />
            <Th>Task</Th>
            <Th>Status</Th>
            <Th>Due</Th>
            <Th>Assignee</Th>
          </Tr>
        </THead>
        <TBody>
          {records.map((record) => {
            const assignee = assigneeLabel(record.data.assignee ?? record.data.assigneeId);
            const due = formatDue(record.data.dueAt);
            const busy = busyIds.has(record.id);
            const done = statusOf(record) === 'DONE';
            const overdue = isOverdue(record);
            return (
              <Tr key={record.id}>
                <Td className="tk-check-cell">
                  <CompleteCheckbox
                    done={done}
                    busy={busy}
                    onToggle={() => onToggleComplete(record)}
                  />
                </Td>
                <Td>
                  <button
                    type="button"
                    className={`tk-row-title${done ? ' is-done' : ''}`}
                    onClick={() => onOpen(record.id)}
                  >
                    {taskTitle(record)}
                  </button>
                </Td>
                <Td>
                  <span className="tk-status-cell">
                    {busy ? (
                      <span className="tk-busy">
                        <Spinner size="sm" label="Saving" />
                      </span>
                    ) : null}
                    <StatusSelect
                      value={statusOf(record)}
                      busy={busy}
                      onChange={(next) => onStatusChange(record, next)}
                    />
                  </span>
                </Td>
                <Td>
                  <span className={overdue ? 'tk-due-overdue' : undefined}>{due ?? '—'}</span>
                </Td>
                <Td>
                  {assignee ? <Tag>{assignee}</Tag> : <span className="tk-cell-muted">Unassigned</span>}
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="tk-table-wrap" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="tk-table-skeleton-row">
          <Skeleton width="100%" height={36} radius={6} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create dialog
// ---------------------------------------------------------------------------

interface CreateDialogProps {
  projectId: string | null;
  /** Pre-seeded status (e.g. from a column's "+" affordance). */
  initialStatus: TaskStatus;
  onClose: () => void;
  onCreated: () => void;
}

function CreateDialog({ projectId, initialStatus, onClose, onCreated }: CreateDialogProps) {
  const [title, setTitle] = React.useState('');
  const [status, setStatus] = React.useState<TaskStatus>(initialStatus);
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

  const formId = React.useId();

  return (
    <Modal
      open
      onClose={onClose}
      title="New task"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={saving}>
            Create task
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="tk-create-form">
        <Field label="Title" required>
          <Input
            value={title}
            required
            autoFocus
            placeholder="What needs doing?"
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label="Status">
          <SelectField
            value={status}
            options={STATUS_SELECT_OPTIONS}
            onChange={(v) => {
              if (isTaskStatus(v)) setStatus(v);
            }}
          />
        </Field>

        <Field label="Due date">
          <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </Field>

        <Field label="Assignee">
          <Input
            value={assignee}
            placeholder="Who owns it?"
            onChange={(e) => setAssignee(e.target.value)}
          />
        </Field>

        <Field label="Notes">
          <Textarea
            value={body}
            rows={3}
            placeholder="Optional details…"
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>

        {error ? <Alert tone="danger">{error}</Alert> : null}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmTasksPage(): React.JSX.Element {
  const { activeProjectId } = useProject();
  const router = useRouter();

  const [view, setView] = React.useState<ViewKind>('board');

  const [groups, setGroups] = React.useState<SabcrmRecordTwGroup[]>([]);
  const [records, setRecords] = React.useState<SabcrmRustRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createFor, setCreateFor] = React.useState<TaskStatus | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());

  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  // Debounce the search box so we don't hammer the engine per keystroke.
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  // Load board groups + flat list (the table reuses the flat list).
  //
  // `groupSabcrmRecordsTw` has no server-side `q`, so the board fetches every
  // status bucket and filters client-side by the debounced search term; the
  // table view threads `q` straight to the engine via `listSabcrmRecordsTw`.
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
          {
            limit: PAGE_LIMIT,
            sortBy: 'updatedAt',
            sortDir: 'desc',
            q: debouncedSearch || undefined,
          },
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
  }, [view, activeProjectId, refreshTick, debouncedSearch]);

  const refresh = React.useCallback(() => setRefreshTick((t) => t + 1), []);

  // Board search runs client-side over the grouped buckets (the engine's
  // group endpoint has no `q`). Matches on the task title, case-insensitively.
  const boardRust = React.useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    const flat = groups.flatMap((g) => g.records);
    if (!term) return flat;
    return flat.filter((r) => taskTitle(r).toLowerCase().includes(term));
  }, [groups, debouncedSearch]);

  // Wire records → the composites' CrmRecord shape. Tasks with a missing /
  // empty status are normalized into TODO so they always have a column.
  const boardRecords = React.useMemo<CrmRecord[]>(
    () =>
      boardRust.map((r) => {
        const crm = rustRecordToCrm(r);
        const raw = crm.data.status;
        if (typeof raw === 'string' && raw) return crm;
        return { ...crm, data: { ...crm.data, status: 'TODO' } };
      }),
    [boardRust],
  );

  // TODO / IN_PROGRESS / DONE, plus a column per unexpected legacy status
  // value the engine returned (parity with the old appended buckets).
  const boardColumns = React.useMemo<RecordBoardColumn[]>(() => {
    const cols: RecordBoardColumn[] = STATUS_OPTIONS.map((o) => ({
      id: o.value,
      label: o.label,
      color: o.color,
    }));
    const extras = new Set<string>();
    for (const rec of boardRecords) {
      const s = asText(rec.data.status);
      if (s && !(STATUS_VALUES as readonly string[]).includes(s)) extras.add(s);
    }
    for (const s of [...extras].sort()) cols.push({ id: s, label: s });
    return cols;
  }, [boardRecords]);

  const findTask = React.useCallback(
    (id: string): SabcrmRustRecord | undefined =>
      boardRust.find((r) => r.id === id) ?? records.find((r) => r.id === id),
    [boardRust, records],
  );

  // Status change (drag, table select, completion checkbox) → optimistic
  // update + persist via the SAME gated record write the old page used.
  const handleStatusChange = React.useCallback(
    async (record: SabcrmRustRecord, next: string) => {
      if (busyIds.has(record.id)) return;
      setBusyIds((b) => new Set(b).add(record.id));

      // Optimistic patch for both projections.
      const patch = (r: SabcrmRustRecord) =>
        r.id === record.id ? { ...r, data: { ...r.data, status: next } } : r;
      setRecords((rs) => rs.map(patch));
      setGroups((gs) => {
        // Move the record between status buckets optimistically.
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

  // RecordBoard drop → persist the new status (same-column reorders are
  // purely visual; the tasks object has no manual ordering to save).
  const handleBoardMove = React.useCallback(
    (recordId: string, toColumnId: string) => {
      const record = findTask(recordId);
      if (!record) return;
      // The board normalizes empty statuses into TODO, so compare against the
      // normalized value to skip same-column reorders / no-op drops.
      const current = asText(record.data.status) || 'TODO';
      if (current === toColumnId) return;
      void handleStatusChange(record, toColumnId);
    },
    [findTask, handleStatusChange],
  );

  // Completion checkbox → toggle DONE ⇄ TODO, reusing the status pipeline.
  const handleToggleComplete = React.useCallback(
    (record: SabcrmRustRecord) => {
      const next: TaskStatus = statusOf(record) === 'DONE' ? 'TODO' : 'DONE';
      void handleStatusChange(record, next);
    },
    [handleStatusChange],
  );

  const openTask = React.useCallback(
    (id: string) => router.push(`/sabcrm/tasks/${id}`),
    [router],
  );

  const handleCreated = React.useCallback(() => refresh(), [refresh]);

  const totalCount = view === 'board' ? boardRecords.length : records.length;

  const isEmpty = !loading && totalCount === 0;
  const isSearching = debouncedSearch.length > 0;

  return (
    <div className="tk-page">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Tasks</PageTitle>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={() => setCreateFor('TODO')}>
            New task
          </Button>
        </PageActions>
      </PageHeader>

      <div className="tk-toolbar">
        <SearchInput
          inputSize="sm"
          value={search}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          onValueChange={setSearch}
        />
        <div className="tk-toolbar__spacer" />
        {!loading ? (
          <span className="tk-count">
            {totalCount} {totalCount === 1 ? 'task' : 'tasks'}
          </span>
        ) : null}
        <SegmentedControl
          size="sm"
          aria-label="View"
          value={view}
          onChange={(v) => setView(v)}
          items={[
            { value: 'board', label: 'Board', icon: Columns3 },
            { value: 'table', label: 'Table', icon: Table2 },
          ]}
        />
      </div>

      {error ? (
        <Alert tone="danger" className="tk-error">
          {error}
        </Alert>
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon={CheckCircle2}
          title={isSearching ? 'No matching tasks' : 'No tasks yet'}
          description={
            isSearching
              ? 'Try a different search term, or clear the search to see every task.'
              : 'Create your first task to start tracking work across To do, In progress and Done.'
          }
          action={
            !isSearching ? (
              <Button variant="primary" iconLeft={Plus} onClick={() => setCreateFor('TODO')}>
                New task
              </Button>
            ) : undefined
          }
        />
      ) : view === 'board' ? (
        <RecordBoard
          columns={boardColumns}
          records={boardRecords}
          groupKey="status"
          loading={loading}
          renderCard={(record) => {
            const task = findTask(record._id);
            if (!task) return null;
            return (
              <TaskCardContent
                record={task}
                busy={busyIds.has(task.id)}
                onToggleComplete={() => handleToggleComplete(task)}
              />
            );
          }}
          onMove={handleBoardMove}
          onCardClick={(record) => openTask(record._id)}
          onAddCard={(columnId) => setCreateFor(isTaskStatus(columnId) ? columnId : 'TODO')}
        />
      ) : loading ? (
        <TableSkeleton />
      ) : (
        <TableView
          records={records}
          busyIds={busyIds}
          onOpen={openTask}
          onStatusChange={handleStatusChange}
          onToggleComplete={handleToggleComplete}
        />
      )}

      {createFor !== null ? (
        <CreateDialog
          projectId={activeProjectId}
          initialStatus={createFor}
          onClose={() => setCreateFor(null)}
          onCreated={handleCreated}
        />
      ) : null}
    </div>
  );
}
