'use client';

import * as React from 'react';
import Link from 'next/link';
import { Network, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';

type Employee = {
  _id: string;
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  designationName?: string;
  departmentName?: string;
  reporting_to?: string | { _id?: string; id?: string };
  managerId?: string;
  status?: string;
  [k: string]: any;
};

type TreeNode = Employee & { children: TreeNode[] };

const STATUS_TONES: Record<string, 'green' | 'amber' | 'neutral' | 'red'> = {
  active: 'green',
  inactive: 'neutral',
  terminated: 'red',
  probation: 'amber',
};

const AVATAR_COLORS = [
  'bg-clay-rose-soft text-clay-rose-ink',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-cyan-100 text-cyan-700',
];

function avatarColor(name: string) {
  const code = name.charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function resolveManagerId(e: Employee): string | null {
  if (e.reporting_to) {
    if (typeof e.reporting_to === 'string') return e.reporting_to;
    if (typeof e.reporting_to === 'object') {
      return (e.reporting_to as any)._id || (e.reporting_to as any).id || null;
    }
  }
  if (e.managerId) return String(e.managerId);
  return null;
}

function buildTree(employees: Employee[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const e of employees) {
    byId.set(String(e._id), { ...e, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const mgr = resolveManagerId(node);
    if (mgr && byId.has(mgr) && mgr !== String(node._id)) {
      byId.get(mgr)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function OrgNode({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const name =
    [node.firstName, node.lastName].filter(Boolean).join(' ') ||
    node.employeeId ||
    'Unnamed';
  const color = avatarColor(name);
  const tone = STATUS_TONES[(node.status || '').toLowerCase()] || 'neutral';
  const hasChildren = node.children.length > 0;

  return (
    <div className={depth > 0 ? 'ml-6 border-l border-clay-border pl-4 pt-1' : ''}>
      <div className="flex items-start gap-2 py-1.5 group">
        {/* Expand/collapse toggle */}
        <button
          type="button"
          onClick={() => hasChildren && setExpanded((v) => !v)}
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-clay-ink-muted transition-colors ${
            hasChildren ? 'hover:text-clay-ink cursor-pointer' : 'opacity-0 pointer-events-none'
          }`}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Avatar */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${color}`}
        >
          {initials(name)}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-[13px] font-medium text-clay-ink">{name}</span>
          {node.designationName && (
            <span className="text-[12px] text-clay-ink-muted">{node.designationName}</span>
          )}
          {node.departmentName && (
            <span className="hidden text-[11px] text-clay-ink-muted sm:inline">
              · {node.departmentName}
            </span>
          )}
          {node.status && (
            <ClayBadge tone={tone} dot>
              {node.status}
            </ClayBadge>
          )}
          {hasChildren && (
            <span className="text-[11px] text-clay-ink-muted">
              {node.children.length} report{node.children.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <OrgNode key={child._id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, startLoading] = useTransition();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    startLoading(async () => {
      try {
        const list = await getCrmEmployees();
        const employees = Array.isArray(list) ? (list as Employee[]) : [];
        setTotal(employees.length);
        setRoots(buildTree(employees));
      } catch (e) {
        console.error('Failed to load employees:', e);
        setFailed(true);
      }
    });
  }, []);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Org Chart"
        subtitle="Reporting hierarchy built from employee records."
        icon={Network}
        actions={
          <Link href="/dashboard/hrm/hr/directory">
            <ClayButton
              variant="pill"
              trailing={<ArrowRight className="h-4 w-4" strokeWidth={1.75} />}
            >
              View Directory
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className={`h-10 w-full ${i > 0 ? 'ml-10' : ''}`} />
            ))}
          </div>
        ) : failed ? (
          <div className="p-8 text-[13px] text-clay-ink-muted">
            Failed to load employee data. Please try refreshing.
          </div>
        ) : roots.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <Network className="h-6 w-6 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <h3 className="text-[15px] font-semibold text-clay-ink">No employees yet</h3>
            <p className="max-w-xl text-[13px] text-clay-ink-muted">
              Add employees via HR-Payroll → Employees to see the org chart.
            </p>
            <Link href="/dashboard/hrm/hr/directory">
              <ClayButton
                variant="obsidian"
                trailing={<ArrowRight className="h-4 w-4" strokeWidth={1.75} />}
              >
                Open Directory
              </ClayButton>
            </Link>
          </div>
        ) : (
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[12px] text-clay-ink-muted">
                {total} employee{total !== 1 ? 's' : ''} · click rows to expand / collapse
              </p>
            </div>
            <div className="space-y-0.5">
              {roots.map((root) => (
                <OrgNode key={root._id} node={root} depth={0} />
              ))}
            </div>
          </div>
        )}
      </ClayCard>
    </div>
  );
}
