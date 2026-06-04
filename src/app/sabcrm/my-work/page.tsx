'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — "My Work" page (`/sabcrm/my-work`), Twenty look.
 *
 * Twenty CRM "Assigned to me / My work" parity: a single, cross-object inbox of
 * every record assigned to the signed-in member in the active project, newest-
 * updated first. Object-agnostic — it lists assignments across *all* objects
 * (people, companies, opportunities, tasks, …) in one continuous Twenty surface,
 * each row linking to `/sabcrm/<object>/<recordId>`.
 *
 * Twenty parity surfaces (mirroring `activities/tasks/TaskGroups`):
 *   • An OBJECT filter — a segmented control (All + every object that actually
 *     has assignments, each with its count) so the inbox can be narrowed to one
 *     object slug. The selection is pushed down to {@link listMyAssignmentsAction}
 *     (`{ object }`) so the engine does the narrowing.
 *   • STATUS GROUPING — when the selected assignments carry a `data.status`,
 *     they render as Twenty status groups (one `TaskList`-style section per
 *     status, newest-updated first within each), exactly like Twenty groups its
 *     tasks. With no statuses present it degrades to one flat assignments table.
 *   • A header REFRESH affordance (consistent with `/sabcrm/activity`).
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
import {
  ClipboardList,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

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

/** Sentinel object-filter key meaning "every object". */
const ALL_OBJECTS = '__all__' as const;

/**
 * Order statuses are shown in (Twenty's task workflow), newest workflow stage
 * last. Anything not in this map sorts after, alphabetically; records with no
 * status fall into the trailing "No status" group.
 */
const STATUS_ORDER: Record<string, number> = {
  TODO: 0,
  'IN PROGRESS': 1,
  IN_PROGRESS: 1,
  BLOCKED: 2,
  DONE: 3,
  COMPLETED: 3,
};

/** Bucket key used for records that carry no status at all. */
const NO_STATUS = '__no_status__';

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

/** Pretty status → Title Case label ("IN_PROGRESS" → "In progress"). */
function humanizeStatus(status: string): string {
  const spaced = status.replace(/[-_]/g, ' ').trim().toLowerCase();
  if (!spaced) return 'No status';
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
// Assignments table (one flat table for a homogeneous slice of records)
// ---------------------------------------------------------------------------

function AssignmentsTable({
  records,
  showStatus,
}: {
  records: CrmRecord[];
  /** Hide the Status column inside a status group (it's the group header). */
  showStatus: boolean;
}): React.JSX.Element {
  // Surface the optional columns only if at least one record carries them, so
  // the table never shows an all-empty Status / Due column for objects (e.g.
  // companies) that don't have those fields.
  const withStatus = showStatus && records.some((r) => deriveStatus(r) !== null);
  const showDue = records.some((r) => deriveDue(r) !== null);

  return (
    <div className="st-table-wrap">
      <table className="st-table">
        <thead>
          <tr>
            <th>Record</th>
            <th>Object</th>
            {withStatus ? <th>Status</th> : null}
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
                {withStatus ? (
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
// Status groups (Twenty's TaskGroups parity — one section per status)
// ---------------------------------------------------------------------------

interface StatusGroup {
  /** Raw status key (or NO_STATUS) used for ordering. */
  key: string;
  /** Display heading for the group. */
  label: string;
  records: CrmRecord[];
}

/** Bucket + order assignments by status, newest-updated first within a group. */
function groupByStatus(records: CrmRecord[]): StatusGroup[] {
  const buckets = new Map<string, CrmRecord[]>();
  for (const record of records) {
    const status = deriveStatus(record);
    const key = status ? status.toUpperCase() : NO_STATUS;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(record);
    else buckets.set(key, [record]);
  }

  const rank = (key: string): number => {
    if (key === NO_STATUS) return 1000;
    return STATUS_ORDER[key] ?? 500;
  };

  return [...buckets.entries()]
    .map(([key, groupRecords]) => {
      groupRecords.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      return {
        key,
        label: key === NO_STATUS ? 'No status' : humanizeStatus(key),
        records: groupRecords,
      };
    })
    .sort((a, b) => {
      const byRank = rank(a.key) - rank(b.key);
      return byRank !== 0 ? byRank : a.label.localeCompare(b.label);
    });
}

function StatusGroups({ records }: { records: CrmRecord[] }): React.JSX.Element {
  const groups = React.useMemo(() => groupByStatus(records), [records]);

  return (
    <div className="stw-groups">
      {groups.map((group) => (
        <section className="stw-status-group" key={group.key}>
          <header className="stw-status-group__head">
            <span className="stw-status-group__title">{group.label}</span>
            <span className="stw-status-group__count">
              {group.records.length}
            </span>
          </header>
          {/* Status is the group header — don't repeat it as a column. */}
          <AssignmentsTable records={group.records} showStatus={false} />
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Object filter (segmented control — All + each object with assignments)
// ---------------------------------------------------------------------------

interface ObjectFilterOption {
  slug: string;
  label: string;
  count: number;
}

function ObjectFilter({
  options,
  active,
  total,
  onSelect,
}: {
  options: ObjectFilterOption[];
  active: string;
  total: number;
  onSelect: (slug: string) => void;
}): React.JSX.Element {
  return (
    <div
      className="stw-filters"
      role="tablist"
      aria-label="Filter assignments by object"
    >
      <button
        type="button"
        role="tab"
        aria-selected={active === ALL_OBJECTS}
        className={`stw-filter${active === ALL_OBJECTS ? ' is-active' : ''}`}
        onClick={() => onSelect(ALL_OBJECTS)}
      >
        All
        {total > 0 ? <span className="stw-filter-count">{total}</span> : null}
      </button>
      {options.map((opt) => {
        const isActive = opt.slug === active;
        return (
          <button
            key={opt.slug}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`stw-filter${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect(opt.slug)}
          >
            {opt.label}
            <span className="stw-filter-count">{opt.count}</span>
          </button>
        );
      })}
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
  // Active object filter slug, or ALL_OBJECTS. Filtering is done client-side
  // over the loaded page so the segmented counts stay live without re-fetching.
  const [objectFilter, setObjectFilter] = React.useState<string>(ALL_OBJECTS);
  // Bumped to force a manual refresh.
  const [reloadKey, setReloadKey] = React.useState(0);

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
  }, [activeProjectId, reloadKey]);

  const refresh = React.useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  // Object-filter options derived from the loaded page (one per object slug
  // that has at least one assignment), with live counts.
  const objectOptions = React.useMemo<ObjectFilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const r of records) {
      counts.set(r.object, (counts.get(r.object) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([slug, count]) => ({ slug, label: humanizeObject(slug), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [records]);

  // Drop a stale object filter if a refresh removed that object's assignments.
  React.useEffect(() => {
    if (
      objectFilter !== ALL_OBJECTS &&
      !objectOptions.some((o) => o.slug === objectFilter)
    ) {
      setObjectFilter(ALL_OBJECTS);
    }
  }, [objectFilter, objectOptions]);

  const visible = React.useMemo(
    () =>
      objectFilter === ALL_OBJECTS
        ? records
        : records.filter((r) => r.object === objectFilter),
    [records, objectFilter],
  );

  // Group by status only when the visible slice actually carries statuses
  // (mirrors Twenty: tasks group by status, plain records list flat).
  const hasStatuses = React.useMemo(
    () => visible.some((r) => deriveStatus(r) !== null),
    [visible],
  );

  const headerActions = (
    <button
      type="button"
      className="stw-refresh"
      onClick={refresh}
      disabled={loading}
      aria-label="Refresh assignments"
      title="Refresh"
    >
      {loading ? (
        <Loader2 size={13} className="stw-spin" aria-hidden="true" />
      ) : (
        <RefreshCw size={13} aria-hidden="true" />
      )}
      Refresh
    </button>
  );

  return (
    <div className="stw-page">
      <TwentyPageHeader
        title="My Work"
        icon={ClipboardList}
        actions={headerActions}
      />

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

          {objectOptions.length > 1 ? (
            <ObjectFilter
              options={objectOptions}
              active={objectFilter}
              total={records.length}
              onSelect={setObjectFilter}
            />
          ) : null}

          {visible.length === 0 ? (
            <div className="st-empty">
              <span className="st-empty__icon" aria-hidden="true">
                <ClipboardList size={20} />
              </span>
              <p className="st-empty__title">Nothing here</p>
              <p className="st-empty__desc">
                No assignments for this object right now.
              </p>
            </div>
          ) : hasStatuses ? (
            <StatusGroups records={visible} />
          ) : (
            <AssignmentsTable records={visible} showStatus />
          )}
        </>
      )}
    </div>
  );
}
