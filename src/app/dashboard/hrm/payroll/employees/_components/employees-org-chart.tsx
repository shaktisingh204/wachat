'use client';

/**
 * <EmployeesOrgChart> — tree view rooted at every employee with no
 * `reportingManagerId`, recursing through direct reports.
 *
 * Pure DOM — no canvas / vendor — built as nested unordered lists with
 * connector lines drawn via Tailwind borders. Cyclic edges (Alice →
 * Bob → Alice) are guarded with a `visited` set.
 */

import * as React from 'react';
import Link from 'next/link';
import { UserCircle2 } from 'lucide-react';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { EmployeeListRow } from './types';

interface EmployeesOrgChartProps {
  rows: EmployeeListRow[];
}

function fullName(row: EmployeeListRow): string {
  return (
    row.displayName ||
    [row.firstName, row.lastName].filter(Boolean).join(' ') ||
    row.workEmail ||
    '—'
  );
}

interface OrgNode {
  row: EmployeeListRow;
  reports: OrgNode[];
}

function buildTree(rows: EmployeeListRow[]): OrgNode[] {
  const byId = new Map<string, EmployeeListRow>();
  for (const r of rows) byId.set(r._id, r);

  const reportsByManager = new Map<string, EmployeeListRow[]>();
  const roots: EmployeeListRow[] = [];

  for (const r of rows) {
    const m = r.reportingManagerId;
    if (m && byId.has(m) && m !== r._id) {
      const list = reportsByManager.get(m) ?? [];
      list.push(r);
      reportsByManager.set(m, list);
    } else {
      roots.push(r);
    }
  }

  const visited = new Set<string>();
  function expand(row: EmployeeListRow): OrgNode {
    if (visited.has(row._id)) {
      return { row, reports: [] };
    }
    visited.add(row._id);
    const reports = (reportsByManager.get(row._id) ?? []).map(expand);
    return { row, reports };
  }

  return roots.map(expand);
}

function OrgNodeCard({ row }: { row: EmployeeListRow }) {
  return (
    <Link
      href={`/dashboard/hrm/payroll/employees/${row._id}`}
      className="inline-flex max-w-xs items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-2.5 py-1.5 text-left text-[12.5px] text-[var(--st-text)] hover:border-[var(--st-text)]/40"
    >
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
        <UserCircle2 className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-medium">{fullName(row)}</span>
        <span className="truncate text-[11px] text-[var(--st-text-secondary)]">
          {row.designation ?? row.employeeId ?? ''}
        </span>
      </span>
      {row.status ? (
        <span className="ml-1 shrink-0">
          <StatusPill
            label={row.status.replace(/_/g, ' ')}
            tone={statusToTone(row.status)}
          />
        </span>
      ) : null}
    </Link>
  );
}

function OrgList({ nodes }: { nodes: OrgNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <ul className="ml-4 mt-1 space-y-1 border-l border-[var(--st-border)] pl-3">
      {nodes.map((n) => (
        <li key={n.row._id} className="relative">
          <span
            aria-hidden
            className="absolute -left-3 top-3 h-px w-3 bg-[var(--st-border)]"
          />
          <OrgNodeCard row={n.row} />
          {n.reports.length > 0 ? <OrgList nodes={n.reports} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function EmployeesOrgChart({ rows }: EmployeesOrgChartProps) {
  const roots = React.useMemo(() => buildTree(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-[13px] text-[var(--st-text-secondary)]">
        No employees match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto p-4">
      <p className="mb-3 text-[11px] text-[var(--st-text-secondary)]">
        Tree rooted at employees with no reporting manager. Click a node to
        open their profile.
      </p>
      <div className="flex flex-wrap gap-6">
        {roots.map((root) => (
          <div key={root.row._id} className="min-w-[260px]">
            <OrgNodeCard row={root.row} />
            {root.reports.length > 0 ? (
              <OrgList nodes={root.reports} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
