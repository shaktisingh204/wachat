'use client';

/**
 * SabCRM — "My Tasks" interactive board (client), Twenty-faithful.
 *
 * Renders a member's assigned tasks in three status columns
 * (To do / In progress / Done) and owns the interactions the surface needs:
 *
 *   1. Completion checkbox — Twenty's rounded checkbox toggles a task between
 *      DONE and TODO, persisting through the gated {@link updateSabcrmRecordTw}
 *      record write. Optimistic via `useTransition`; on failure we revert and
 *      surface the action's `{ ok: false, error }` inline.
 *   2. Inline status change — a `<select>` matching the top-level Tasks board.
 *   3. Open source record — a link to `/sabcrm/<object>/<id>`.
 *
 * Design system: ONLY the `.sabcrm-twenty` kit (`.st-*` / `.stn-*` classes +
 * the co-located `../tasks-notes.css`) — NO ZoruUI / Tailwind / clay. There are
 * no file inputs on this surface, so no SabFiles picker is needed.
 *
 * NOTE: this is a reusable board component (exported as {@link MyTasksBoard});
 * the route itself is rendered by the sibling `./page.tsx`.
 */

import * as React from 'react';
import Link from 'next/link';
import { Loader2, Check, CalendarClock } from 'lucide-react';

import { updateSabcrmRecordTw } from '@/app/actions/sabcrm-twenty.actions';
import { useProject } from '@/context/project-context';

import '@/styles/sabcrm-twenty.css';
import '../tasks-notes.css';

/** The three task statuses (kept local — no server-module import in a client). */
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

/** A serialisable, client-safe view of one assigned task record. */
export interface AssignedTask {
  /** The underlying `sabcrm_records` id (used for the status write + link). */
  id: string;
  /** Object slug the record belongs to (e.g. `tasks`). */
  object: string;
  title: string;
  body: string;
  status: TaskStatus;
  /** ISO-8601 due date, or `null` when unset. */
  dueAt: string | null;
  /** ISO-8601 last-updated timestamp. */
  updatedAt: string;
}

interface MyTasksBoardProps {
  tasks: AssignedTask[];
}

/** The three task statuses, in board order, with their human column labels. */
const COLUMNS: ReadonlyArray<{ status: TaskStatus; label: string }> = [
  { status: 'TODO', label: 'To do' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'DONE', label: 'Done' },
];

/** Formats an ISO date for the due-date chip; returns null when unparseable. */
function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/** True when a due date is in the past (and the task isn't done). */
function isOverdue(iso: string | null, status: TaskStatus): boolean {
  if (!iso || status === 'DONE') return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

/**
 * One task card: a completion checkbox, title, optional body, due-date meta,
 * an inline status `<select>` and an "Open record" link.
 */
function TaskCard({ task }: { task: AssignedTask }) {
  const { activeProjectId } = useProject();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  // Optimistic status so the controls reflect the click before the round-trip.
  const [optimisticStatus, setOptimisticStatus] = React.useState<TaskStatus>(task.status);

  // Re-sync if the parent hands us a fresh status.
  React.useEffect(() => {
    setOptimisticStatus(task.status);
  }, [task.status]);

  const changeStatus = React.useCallback(
    (next: TaskStatus) => {
      if (next === optimisticStatus || pending) return;
      const previous = optimisticStatus;
      setError(null);
      setOptimisticStatus(next);
      startTransition(async () => {
        const res = await updateSabcrmRecordTw(
          task.object,
          task.id,
          { status: next },
          activeProjectId ?? undefined,
        );
        if (!res.ok) {
          setOptimisticStatus(previous);
          setError(res.error);
        }
      });
    },
    [optimisticStatus, pending, task.id, task.object, activeProjectId],
  );

  const done = optimisticStatus === 'DONE';
  const due = formatDue(task.dueAt);
  const overdue = isOverdue(task.dueAt, optimisticStatus);

  return (
    <div className="st-card stn-board-card">
      <div className="stn-card-head">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? 'Mark task as to do' : 'Mark task as done'}
          disabled={pending}
          className={`stn-check${done ? ' is-done' : ''}`}
          onClick={() => changeStatus(done ? 'TODO' : 'DONE')}
        >
          {done ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : null}
        </button>
        <Link
          href={`/sabcrm/${task.object}/${task.id}`}
          className={`stn-card-title${done ? ' is-done' : ''}`}
        >
          {task.title || 'Untitled task'}
        </Link>
      </div>

      {task.body ? <p className="stn-note__body">{task.body}</p> : null}

      {due ? (
        <div className={`stn-card-meta${overdue ? ' is-overdue' : ''}`}>
          <span className="stn-card-meta__label">
            <CalendarClock size={13} aria-hidden="true" />
          </span>
          {due}
          {overdue ? <span className="stn-overdue-tag">Overdue</span> : null}
        </div>
      ) : null}

      <div className="stn-card-foot">
        <select
          className="stn-status-select"
          value={optimisticStatus}
          disabled={pending}
          aria-label="Task status"
          onChange={(e) => changeStatus(e.target.value as TaskStatus)}
        >
          {COLUMNS.map(({ status, label }) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </select>
        <span className="stn-card-foot__status">
          {pending ? (
            <span className="stn-card-busy">
              <Loader2 size={13} className="st-spin" />
            </span>
          ) : null}
        </span>
      </div>

      {error ? <span className="stn-inline-error">{error}</span> : null}
    </div>
  );
}

/** One status column with its header count and stacked task cards. */
function StatusColumn({ label, tasks }: { label: string; tasks: AssignedTask[] }) {
  return (
    <div className="st-board__col" aria-label={label}>
      <div className="st-board__head">
        <span className="stn-board__title">{label}</span>
        <span className="st-board__count">{tasks.length}</span>
      </div>
      <div className="st-board__body">
        {tasks.length === 0 ? (
          <div className="st-board__empty">No tasks</div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}

export function MyTasksBoard({ tasks }: MyTasksBoardProps) {
  // Bucket tasks by status once, preserving the parent's order.
  const byStatus = React.useMemo(() => {
    const buckets: Record<TaskStatus, AssignedTask[]> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    for (const task of tasks) buckets[task.status].push(task);
    return buckets;
  }, [tasks]);

  return (
    <div className="st-board">
      {COLUMNS.map(({ status, label }) => (
        <StatusColumn key={status} label={label} tasks={byStatus[status]} />
      ))}
    </div>
  );
}

export default MyTasksBoard;
