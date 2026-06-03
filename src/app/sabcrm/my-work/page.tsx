'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — "My Work" page (`/sabcrm/my-work`), Twenty look.
 *
 * Twenty CRM "Assigned to me / My work" parity: a single, cross-object inbox of
 * every record assigned to the signed-in member in the active project, newest-
 * updated first. Object-agnostic — it lists assignments across *all* objects
 * (people, companies, opportunities, tasks, …) in one continuous Twenty table,
 * each row linking to `/sabcrm/<object>/<recordId>`.
 *
 * Client Component. Auth / onboarding / RBAC / project context are enforced by
 * `../layout.tsx`, which wraps every `/sabcrm/*` child in `RBACGuard` +
 * `ProjectProvider` and mounts them inside `TwentyAppFrame` (the `.sabcrm-twenty`
 * scope + `.st-main__content` padding). {@link listMyAssignmentsAction} (behind
 * `sabcrm:view`) independently re-runs the full session → project → RBAC → plan
 * pipeline, so this page fails closed (calm in-page error / empty state) for
 * anyone who slips past the layout guard.
 *
 * Data model
 * ----------
 * {@link listMyAssignmentsAction} returns `{ records: CrmRecord[]; total; … }`.
 * A `CrmRecord` carries only `_id`, `object`, `userId`, a free-form `data` map
 * and ISO `createdAt` / `updatedAt` — there is no precomputed label/status
 * field, so we derive a display title from the conventional label keys
 * (`title` / `name` / `label` / …) and surface `data.status` + a due date *only
 * when the record's `data` actually contains them*, rendering them through
 * {@link TwentyFieldValue} (synthetic SELECT / DATE fields) for Twenty-faithful
 * presentation.
 *
 * Twenty look only (`.st-*` + `./my-work.css`). NO ZoruUI / Tailwind / clay.
 */

import * as React from 'react';
import Link from 'next/link';
import { ClipboardList, AlertTriangle } from 'lucide-react';

import { listMyAssignmentsAction } from '@/app/actions/sabcrm.actions';
import { TwentyPageHeader, TwentyChip } from '@/components/sabcrm/twenty';
import { TwentyFieldValue } from '@/components/sabcrm/twenty/twenty-field';
import type { CrmRecord, FieldMetadata } from '@/lib/sabcrm/types';
import { useProject } from '@/context/project-context';

import './my-work.css';

// ---------------------------------------------------------------------------
// Synthetic fields used to drive TwentyFieldValue for the optional columns.
// ---------------------------------------------------------------------------

/** A bare SELECT field (no options) so a status value renders as a chip. */
const STATUS_FIELD: FieldMetadata = {
  key: 'status',
  label: 'Status',
  type: 'SELECT',
};

/** A DATE field so a due date renders Twenty-humanized ("Apr 3, 2026"). */
const DUE_FIELD: FieldMetadata = {
  key: 'dueAt',
  label: 'Due',
  type: 'DATE',
};

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
 * row is always linkable / readable.
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
 * Read a raw due value from the conventional date keys, only if present + a
 * parseable date. Returns the raw value (for {@link TwentyFieldValue}) or null.
 */
function deriveDue(record: CrmRecord): string | number | null {
  const d = record.data;
  for (const key of ['dueAt', 'dueDate', 'due']) {
    const raw = d[key];
    if (raw === null || raw === undefined || raw === '') continue;
    if (typeof raw === 'string' || typeof raw === 'number') {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return raw;
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

function MyWorkSkeleton(): React.JSX.Element {
  return (
    <div className="st-table-wrap" aria-hidden="true">
      <div style={{ padding: 'var(--st-space-3)' }}>
        <div className="st-skeleton st-skeleton-row" style={{ height: 28 }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="st-skeleton st-skeleton-row" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assignments table
// ---------------------------------------------------------------------------

function AssignmentsTable({ records }: { records: CrmRecord[] }): React.JSX.Element {
  // Surface the optional columns only if at least one record carries them, so
  // the table never shows an all-empty Status / Due column for objects (e.g.
  // companies) that don't have those fields.
  const showStatus = records.some((r) => deriveStatus(r) !== null);
  const showDue = records.some((r) => deriveDue(r) !== null);

  return (
    <div className="st-table-wrap">
      <table className="st-table">
        <thead>
          <tr>
            <th>Record</th>
            <th>Object</th>
            {showStatus ? <th>Status</th> : null}
            {showDue ? <th>Due</th> : null}
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const status = deriveStatus(record);
            const due = deriveDue(record);
            const updated = formatUpdated(record.updatedAt);
            return (
              <tr key={record._id} className="st-row">
                <td>
                  <Link
                    href={`/sabcrm/${record.object}/${record._id}`}
                    className="st-cell-link"
                  >
                    {deriveTitle(record)}
                  </Link>
                </td>
                <td className="stw-cell-object">
                  <TwentyChip label={humanizeObject(record.object)} />
                </td>
                {showStatus ? (
                  <td>
                    {status ? (
                      <TwentyFieldValue field={STATUS_FIELD} value={status} />
                    ) : (
                      <span className="st-cell-muted">—</span>
                    )}
                  </td>
                ) : null}
                {showDue ? (
                  <td>
                    {due !== null ? (
                      <TwentyFieldValue field={DUE_FIELD} value={due} />
                    ) : (
                      <span className="st-cell-muted">—</span>
                    )}
                  </td>
                ) : null}
                <td className="stw-cell-meta">
                  {updated || <span className="st-cell-muted">—</span>}
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
// Page
// ---------------------------------------------------------------------------

export default function MyWorkPage(): React.JSX.Element {
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
    <div className="stw-page">
      <TwentyPageHeader title="My Work" icon={ClipboardList} />

      {loading ? (
        <MyWorkSkeleton />
      ) : error ? (
        <div className="st-banner" role="alert">
          <AlertTriangle size={16} className="st-banner__icon" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : records.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon" aria-hidden="true">
            <ClipboardList size={20} />
          </span>
          <p className="st-empty__title">Nothing assigned to you</p>
          <p className="st-empty__desc">
            When a record is assigned to you it will show up here, ready to pick
            up.
          </p>
        </div>
      ) : (
        <>
          <p className="stw-count">
            {total} {total === 1 ? 'record' : 'records'} assigned to you
          </p>
          <AssignmentsTable records={records} />
        </>
      )}
    </div>
  );
}
