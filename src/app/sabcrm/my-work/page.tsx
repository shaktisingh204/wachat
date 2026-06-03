'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — "My Work" page (`/sabcrm/my-work`).
 *
 * Twenty CRM "Assigned to me / My work" parity: a single, cross-object inbox
 * of every record assigned to the signed-in member in the active project,
 * newest-updated first. Unlike `/sabcrm/tasks` (which narrows the same inbox to
 * the standard `tasks` object and groups by status), this surface is
 * intentionally object-agnostic — it lists assignments across *all* objects
 * (people, companies, opportunities, tasks, …) in one continuous table, each
 * row linking to the source record.
 *
 * Client Component. Auth / onboarding / RBAC / project context are already
 * enforced by `../layout.tsx` (which wraps every `/sabcrm/*` child in
 * `RBACGuard` + `ProjectProvider` inside the `.zoruui` scope). The underlying
 * server action ({@link listMyAssignmentsAction}, behind `sabcrm:view`)
 * independently re-runs the full session → project → RBAC → plan pipeline, so
 * this page fails closed (a calm in-page error / empty state) for anyone who
 * slips past the layout guard.
 *
 * Data model
 * ----------
 * {@link listMyAssignmentsAction} returns a {@link MyAssignmentsPage}:
 * `{ records: CrmRecord[]; total; page; pageSize }`. A `CrmRecord` carries only
 * `_id`, `object` (slug), `userId`, a free-form `data` map and ISO `createdAt` /
 * `updatedAt` — there is no precomputed label/status field, so we derive a
 * display title from the conventional label keys (`title` / `name` / `label` /
 * an email) and surface `data.status` + a due date *only when the record's
 * `data` actually contains them*. Each row links to
 * `/sabcrm/<object>/<recordId>`, matching the record-index link shape.
 *
 * `AssignmentControl` is intentionally NOT mounted here: it requires a workspace
 * `members` roster (for the re-assign picker) that the assignment list does not
 * carry, so this page is a read + link surface — re-assignment happens on the
 * record detail screen each row links to.
 */

import * as React from 'react';
import Link from 'next/link';
import { ClipboardList, AlertTriangle } from 'lucide-react';

import { listMyAssignmentsAction } from '@/app/actions/sabcrm.actions';
import type { CrmRecord } from '@/lib/sabcrm/types';
import { useProject } from '@/context/project-context';
import {
  Badge,
  Skeleton,
  EmptyState,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
} from '@/components/zoruui';

// ---------------------------------------------------------------------------
// Value helpers (the `data` map is free-form, so every read is defensive)
// ---------------------------------------------------------------------------

/** Coerce an unknown `data` value to a trimmed display string (or ''). */
function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

/**
 * Derive a human title for an assignment from the conventional label keys an
 * object's records use, in priority order. Falls back to a generic label so the
 * row is always linkable/readable.
 */
function deriveTitle(record: CrmRecord): string {
  const d = record.data;
  for (const key of ['title', 'name', 'label', 'fullName', 'subject', 'email']) {
    const v = asText(d[key]);
    if (v) return v;
  }
  return 'Untitled record';
}

/** Read `data.status` only if the record actually carries a string status. */
function deriveStatus(record: CrmRecord): string | null {
  const v = asText(record.data.status);
  return v || null;
}

/**
 * Read a due date from the conventional date keys, only if present + valid.
 * Returns a locale date string, or null when the record has no due date.
 */
function deriveDueDate(record: CrmRecord): string | null {
  const d = record.data;
  for (const key of ['dueAt', 'dueDate', 'due']) {
    const raw = d[key];
    if (raw === null || raw === undefined || raw === '') continue;
    if (typeof raw === 'string' || typeof raw === 'number' || raw instanceof Date) {
      const parsed = new Date(raw as string | number | Date);
      if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString();
    }
  }
  return null;
}

/** Pretty object-slug → human label (e.g. `opportunities` → `Opportunities`). */
function humanizeObject(slug: string): string {
  if (!slug) return 'Record';
  const spaced = slug.replace(/[-_]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Format the record's ISO `updatedAt` to a locale date (or '' if unparsable). */
function formatUpdated(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function MyWorkSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assignments table
// ---------------------------------------------------------------------------

function AssignmentsTable({ records }: { records: CrmRecord[] }) {
  // Surface the optional columns only if at least one record carries them, so
  // the table never shows an all-empty Status / Due column for objects (e.g.
  // companies) that don't have those fields.
  const showStatus = records.some((r) => deriveStatus(r) !== null);
  const showDue = records.some((r) => deriveDueDate(r) !== null);

  return (
    <div className="overflow-hidden rounded-xl border border-zoru-line">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Record</TableHead>
            <TableHead>Object</TableHead>
            {showStatus && <TableHead>Status</TableHead>}
            {showDue && <TableHead>Due</TableHead>}
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const status = deriveStatus(record);
            const due = deriveDueDate(record);
            const updated = formatUpdated(record.updatedAt);
            return (
              <TableRow key={record._id}>
                <TableCell>
                  <Link
                    href={`/sabcrm/${record.object}/${record._id}`}
                    className="font-medium text-zoru-ink hover:underline"
                  >
                    {deriveTitle(record)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{humanizeObject(record.object)}</Badge>
                </TableCell>
                {showStatus && (
                  <TableCell>
                    {status ? (
                      <Badge variant="secondary">{status}</Badge>
                    ) : (
                      <span className="text-zoru-ink-muted">—</span>
                    )}
                  </TableCell>
                )}
                {showDue && (
                  <TableCell>
                    {due ?? <span className="text-zoru-ink-muted">—</span>}
                  </TableCell>
                )}
                <TableCell>
                  {updated ? (
                    <span className="text-sm text-zoru-ink-muted">{updated}</span>
                  ) : (
                    <span className="text-zoru-ink-muted">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MyWorkPage() {
  const { activeProjectId } = useProject();

  const [records, setRecords] = React.useState<CrmRecord[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const res = await listMyAssignmentsAction(
        undefined,
        activeProjectId ?? undefined,
      );
      if (cancelled) return;

      if (!res.ok) {
        setError(res.error);
        setRecords([]);
        setTotal(0);
      } else {
        setRecords(res.data.records);
        setTotal(res.data.total);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Assigned to me</ZoruPageEyebrow>
          <ZoruPageTitle>My Work</ZoruPageTitle>
          <ZoruPageDescription>
            Every record assigned to you across this workspace, newest first.
            Open any record to see its full timeline or hand it off to a
            teammate.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {loading ? (
        <MyWorkSkeleton />
      ) : error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <ZoruAlertTitle>My Work is unavailable</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="Nothing assigned to you"
          description="When a record is assigned to you it will show up here, ready to pick up."
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-zoru-ink-muted">
            {total} {total === 1 ? 'record' : 'records'} assigned to you
          </p>
          <AssignmentsTable records={records} />
        </>
      )}
    </main>
  );
}
