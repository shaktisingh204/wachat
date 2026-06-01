'use client';

/**
 * SabCRM — "My Tasks" interactive board (client).
 *
 * Renders the signed-in member's assigned tasks in three status columns
 * (To do / In progress / Done) and owns the two interactions the page needs:
 *
 *   1. Inline status change — a black-&-white ZoruUI segmented control that
 *      patches `record.data.status` through the gated {@link updateRecordAction}
 *      (a `sabcrm:manage` record write). Optimistic via `useTransition`; on
 *      success we `router.refresh()` so the server re-buckets the task, on
 *      failure we surface the action's `{ ok: false, error }` inline and revert.
 *   2. Open source record — a link to the record detail route
 *      `/sabcrm/<object>/<id>`.
 *
 * No bespoke design: everything is composed from `@/components/zoruui`
 * primitives and namespaced `--zoru-*` tokens (matching the sibling
 * `../page.tsx`). There are no file inputs on this surface, so no SabFiles
 * picker is needed.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { updateRecordAction } from '@/app/actions/sabcrm.actions';
import type { TaskStatus } from '@/lib/sabcrm/activities.server';
import { Badge, Button, Card, cn } from '@/components/zoruui';

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

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

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
 * One task card: title, optional body, due-date chip, an inline status
 * segmented control and an "Open record" link.
 */
function TaskCard({ task }: { task: AssignedTask }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  // Optimistic status so the control reflects the click before the refresh.
  const [optimisticStatus, setOptimisticStatus] = React.useState<TaskStatus>(
    task.status,
  );

  // Re-sync if the server hands us a fresh status after a refresh.
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
        const res = await updateRecordAction(task.id, { status: next });
        if (!res.ok) {
          setOptimisticStatus(previous);
          setError(res.error);
          return;
        }
        // Server re-buckets the task into its new column.
        router.refresh();
      });
    },
    [optimisticStatus, pending, task.id, router],
  );

  const due = formatDue(task.dueAt);
  const overdue = isOverdue(task.dueAt, optimisticStatus);

  return (
    <Card variant="soft" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold leading-snug text-zoru-ink">
          {task.title}
        </span>
        {task.body ? (
          <p className="line-clamp-3 text-xs leading-relaxed text-zoru-ink-muted">
            {task.body}
          </p>
        ) : null}
      </div>

      {due ? (
        <div className="flex items-center gap-2">
          <Badge variant={overdue ? 'info' : 'secondary'}>
            {overdue ? 'Overdue' : 'Due'} {due}
          </Badge>
        </div>
      ) : null}

      {/* Inline status change — segmented control built from base Buttons. */}
      <div
        role="group"
        aria-label="Task status"
        className="flex flex-wrap items-center gap-1.5"
      >
        {COLUMNS.map(({ status, label }) => {
          const active = status === optimisticStatus;
          return (
            <Button
              key={status}
              type="button"
              disabled={pending}
              aria-pressed={active}
              onClick={() => changeStatus(status)}
              className={cn(
                'h-7 rounded-md px-2.5 text-xs font-medium',
                active
                  ? 'bg-zoru-ink text-zoru-surface'
                  : 'bg-transparent text-zoru-ink-muted ring-1 ring-inset ring-zoru-border hover:text-zoru-ink',
                pending && 'opacity-70',
              )}
            >
              {label}
            </Button>
          );
        })}
      </div>

      {error ? (
        <p className="text-xs leading-relaxed text-zoru-ink" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
          {STATUS_LABEL[optimisticStatus]}
        </span>
        <Link
          href={`/sabcrm/${task.object}/${task.id}`}
          aria-label={`Open ${task.title}`}
          className="text-xs font-medium text-zoru-ink underline-offset-2 hover:underline"
        >
          Open record
        </Link>
      </div>
    </Card>
  );
}

/** One status column with its header count and stacked task cards. */
function StatusColumn({
  label,
  tasks,
}: {
  label: string;
  tasks: AssignedTask[];
}) {
  return (
    <section className="flex flex-col gap-3" aria-label={label}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zoru-ink">{label}</h2>
        <span className="text-xs tabular-nums text-zoru-ink-muted">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <Card
          variant="soft"
          className="items-center justify-center py-8 text-center"
        >
          <span className="text-xs text-zoru-ink-muted">No tasks</span>
        </Card>
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskCard task={task} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MyTasksBoard({ tasks }: MyTasksBoardProps) {
  // Bucket tasks by status once, preserving the server's newest-updated order.
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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {COLUMNS.map(({ status, label }) => (
        <StatusColumn key={status} label={label} tasks={byStatus[status]} />
      ))}
    </div>
  );
}
