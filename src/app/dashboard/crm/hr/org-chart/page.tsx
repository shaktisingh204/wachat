'use client';

import { ZoruBadge, ZoruButton, ZoruCard, ZoruInput, ZoruSkeleton } from '@/components/zoruui';
import {
  Network,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useEffect, useState, useTransition, useMemo } from 'react';

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
};

type TreeNode = Employee & { children: TreeNode[] };

interface OrgKpis {
  total: number;
  departments: number;
  managers: number;
  maxDepth: number;
}

const STATUS_VARIANTS: Record<
  string,
  'success' | 'warning' | 'ghost' | 'danger'
> = {
  active: 'success',
  inactive: 'ghost',
  terminated: 'danger',
  probation: 'warning',
};

const AVATAR_COLORS = [
  'bg-zoru-surface-2 text-zoru-ink',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-cyan-100 text-cyan-700',
];

function avatarColor(name: string): string {
  const code = name.charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

function initials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function resolveManagerId(e: Employee): string | null {
  if (e.reporting_to) {
    if (typeof e.reporting_to === 'string') return e.reporting_to;
    if (typeof e.reporting_to === 'object') {
      const r = e.reporting_to as { _id?: string; id?: string };
      return r._id ?? r.id ?? null;
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

function treeDepth(nodes: TreeNode[]): number {
  if (nodes.length === 0) return 0;
  return 1 + Math.max(...nodes.map((n) => treeDepth(n.children)));
}

function nodeMatchesSearch(node: TreeNode, q: string): boolean {
  const name = [node.firstName, node.lastName].filter(Boolean).join(' ').toLowerCase();
  return (
    name.includes(q) ||
    (node.employeeId ?? '').toLowerCase().includes(q) ||
    (node.designationName ?? '').toLowerCase().includes(q) ||
    (node.departmentName ?? '').toLowerCase().includes(q)
  );
}

function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  if (!q) return nodes;
  return nodes
    .map((node) => {
      const filteredChildren = filterTree(node.children, q);
      if (nodeMatchesSearch(node, q) || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    })
    .filter((n): n is TreeNode => n !== null);
}

function OrgNode({ node, depth }: { node: TreeNode; depth: number }): React.JSX.Element {
  const [expanded, setExpanded] = useState(depth < 2);
  const name =
    [node.firstName, node.lastName].filter(Boolean).join(' ') ||
    node.employeeId ||
    'Unnamed';
  const color = avatarColor(name);
  const variant = STATUS_VARIANTS[String(node.status ?? '').toLowerCase()] ?? 'ghost';
  const hasChildren = node.children.length > 0;

  return (
    <div className={depth > 0 ? 'ml-6 border-l border-zoru-line pl-4 pt-1' : ''}>
      <div className="flex items-start gap-2 py-1.5 group">
        <button
          type="button"
          onClick={() => hasChildren && setExpanded((v) => !v)}
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-zoru-ink-muted transition-colors ${
            hasChildren
              ? 'hover:text-zoru-ink cursor-pointer'
              : 'opacity-0 pointer-events-none'
          }`}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] ${color}`}
        >
          {initials(name)}
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-[13px] text-zoru-ink">{name}</span>
          {node.designationName ? (
            <span className="text-[12px] text-zoru-ink-muted">{node.designationName}</span>
          ) : null}
          {node.departmentName ? (
            <span className="hidden text-[11px] text-zoru-ink-muted sm:inline">
              · {node.departmentName}
            </span>
          ) : null}
          {node.status ? (
            <ZoruBadge variant={variant}>{node.status}</ZoruBadge>
          ) : null}
          {hasChildren ? (
            <span className="text-[11px] text-zoru-ink-muted">
              {node.children.length} report{node.children.length !== 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
      </div>

      {hasChildren && expanded ? (
        <div>
          {node.children.map((child) => (
            <OrgNode key={String(child._id)} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function OrgChartPage(): React.JSX.Element {
  const [allRoots, setAllRoots] = useState<TreeNode[]>([]);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<OrgKpis>({ total: 0, departments: 0, managers: 0, maxDepth: 0 });
  const [search, setSearch] = useState('');
  const [isLoading, startLoading] = useTransition();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    startLoading(async () => {
      try {
        const list = await getCrmEmployees();
        const employees = Array.isArray(list) ? (list as Employee[]) : [];
        setTotal(employees.length);

        const roots = buildTree(employees);
        setAllRoots(roots);

        const depts = new Set<string>();
        let managers = 0;
        for (const e of employees) {
          if (e.departmentName) depts.add(e.departmentName);
        }
        // A manager is anyone who has at least one direct report in the tree
        function countManagers(nodes: TreeNode[]): number {
          let c = 0;
          for (const n of nodes) {
            if (n.children.length > 0) c += 1;
            c += countManagers(n.children);
          }
          return c;
        }
        managers = countManagers(roots);
        const maxDepth = treeDepth(roots);

        setKpis({
          total: employees.length,
          departments: depts.size,
          managers,
          maxDepth,
        });
      } catch (e) {
        console.error('Failed to load employees:', e);
        setFailed(true);
      }
    });
  }, []);

  const q = search.trim().toLowerCase();
  const roots = useMemo(
    () => filterTree(allRoots, q),
    [allRoots, q],
  );

  return (
    <EntityListShell
      title="Org Chart"
      subtitle="Reporting hierarchy built from employee records."
      primaryAction={
        <Link href="/dashboard/crm/hr/directory">
          <ZoruButton variant="outline">
            View Directory
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </ZoruButton>
        </Link>
      }
    >
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ZoruCard className="p-3">
          <p className="text-xs text-zoru-ink-muted">Total employees</p>
          <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.total}</p>
        </ZoruCard>
        <ZoruCard className="p-3">
          <p className="text-xs text-zoru-ink-muted">Departments</p>
          <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.departments}</p>
        </ZoruCard>
        <ZoruCard className="p-3">
          <p className="text-xs text-zoru-ink-muted">Managers</p>
          <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.managers}</p>
        </ZoruCard>
        <ZoruCard className="p-3">
          <p className="text-xs text-zoru-ink-muted">Hierarchy depth</p>
          <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.maxDepth}</p>
        </ZoruCard>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <ZoruInput
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, designation, department…"
          leadingSlot={<Search />}
        />
      </div>

      <ZoruCard>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-6">
            {[...Array(5)].map((_, i) => (
              <ZoruSkeleton key={i} className={`h-10 w-full ${i > 0 ? 'ml-10' : ''}`} />
            ))}
          </div>
        ) : failed ? (
          <div className="p-8 text-[13px] text-zoru-ink-muted">
            Failed to load employee data. Please try refreshing.
          </div>
        ) : roots.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zoru-surface-2">
              <Network className="h-6 w-6 text-zoru-ink" strokeWidth={1.75} />
            </div>
            <h3 className="text-[15px] text-zoru-ink">
              {q ? `No results for "${search}"` : 'No employees yet'}
            </h3>
            <p className="max-w-xl text-[13px] text-zoru-ink-muted">
              {q
                ? 'Try a different search term.'
                : 'Add employees via HR-Payroll → Employees to see the org chart.'}
            </p>
            {!q ? (
              <Link href="/dashboard/crm/hr/directory">
                <ZoruButton>
                  Open Directory
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </ZoruButton>
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[12px] text-zoru-ink-muted">
                {q
                  ? `${roots.length} result${roots.length !== 1 ? 's' : ''} for "${search}" — click to expand / collapse`
                  : `${total} employee${total !== 1 ? 's' : ''} · click rows to expand / collapse`}
              </p>
            </div>
            <div className="space-y-0.5">
              {roots.map((root) => (
                <OrgNode key={String(root._id)} node={root} depth={0} />
              ))}
            </div>
          </div>
        )}
      </ZoruCard>
    </EntityListShell>
  );
}
