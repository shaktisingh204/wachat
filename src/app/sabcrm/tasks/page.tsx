export const dynamic = 'force-dynamic';

/**
 * SabCRM — "My Tasks / Assignments" page (`/sabcrm/tasks`).
 *
 * The personal inbox for the signed-in member: every CRM record assigned to
 * them in the active project, grouped by task status (To do / In progress /
 * Done), with an inline status change and a link to open the source record.
 *
 * Server Component. Auth / onboarding / RBAC / project context are already
 * enforced by `../layout.tsx` (which wraps every `/sabcrm/*` child in
 * `RBACGuard` + `ProjectProvider` inside the `.zoruui` scope), and the SabCRM
 * server actions below independently re-run the full session → project → RBAC
 * (`sabcrm:view`) → plan gate — so this page fails closed (a calm empty state)
 * for anyone who slips past the layout guard.
 *
 * Data model
 * ----------
 * Assignment lives on `record.data.assigneeId` (see `assignment.server.ts`), so
 * {@link listMyAssignmentsAction} returns the raw `tasks` records owned by the
 * member. A `tasks` record carries `data.status` (the SELECT field whose options
 * are TODO / IN_PROGRESS / DONE — see the standard schema), `data.title` (the
 * label field) and `data.dueAt`. The inline status control therefore patches
 * `record.data.status` through the gated {@link updateRecordAction} (a record
 * write, behind `sabcrm:manage`) — the only write that actually mutates an
 * assigned record's status. (The activity-timeline `setTaskStatusAction` keys on
 * the `sabcrm_activities` collection by activity id and would no-op on a record
 * id, so it is intentionally NOT used here.)
 */

import {
  listMyAssignmentsAction,
} from '@/app/actions/sabcrm.actions';
import type { TaskStatus } from '@/lib/sabcrm/activities.server';
import type { CrmRecord } from '@/lib/sabcrm/types';
import {
  EmptyState,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
} from '@/components/zoruui';

import { MyTasksBoard, type AssignedTask } from './my-tasks-board';

export const metadata = {
  title: 'My Tasks · SabCRM',
};

/** The standard `tasks` object slug whose assignments this page surfaces. */
const TASKS_OBJECT = 'tasks';

const TASK_STATUS_VALUES: readonly TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === 'string' &&
    (TASK_STATUS_VALUES as readonly string[]).includes(value)
  );
}

/** Coerce an unknown `data` value to a trimmed display string (or ''). */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

/** Coerce an unknown `data.dueAt` value to an ISO string (or null). */
function asIsoDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/**
 * Projects a raw assigned `tasks` record onto the serialisable, client-safe
 * {@link AssignedTask} shape the board renders. The status falls back to "TODO"
 * for records whose SELECT value is missing/legacy, mirroring the runtime.
 */
function toAssignedTask(record: CrmRecord): AssignedTask {
  const rawStatus = record.data.status;
  const title = asText(record.data.title).trim();
  return {
    id: record._id,
    object: record.object,
    title: title || 'Untitled task',
    body: asText(record.data.body).trim(),
    status: isTaskStatus(rawStatus) ? rawStatus : 'TODO',
    dueAt: asIsoDate(record.data.dueAt),
    updatedAt: record.updatedAt,
  };
}

export default async function MyTasksPage() {
  const result = await listMyAssignmentsAction({ object: TASKS_OBJECT });

  // Permission / plan / project failures from the gate surface here — render a
  // calm, on-brand empty state instead of crashing the route.
  if (!result.ok) {
    return (
      <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
        <EmptyState
          title="My Tasks is unavailable"
          description={result.error}
        />
      </main>
    );
  }

  const tasks = result.data.records.map(toAssignedTask);

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Assigned to me</ZoruPageEyebrow>
          <ZoruPageTitle>My Tasks</ZoruPageTitle>
          <ZoruPageDescription>
            Every task assigned to you, grouped by status. Update a task&rsquo;s
            status inline, or open its record for the full timeline.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {tasks.length === 0 ? (
        <EmptyState
          title="Nothing assigned to you"
          description="When a task is assigned to you it will show up here, organised by status."
        />
      ) : (
        <MyTasksBoard tasks={tasks} />
      )}
    </main>
  );
}
