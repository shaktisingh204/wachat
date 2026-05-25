'use client';

import { Badge, Button, Card } from '@/components/zoruui';
import { Network, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import * as React from 'react';
import Link from 'next/link';

export type Employee = {
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

export type TreeNode = Employee & { children: TreeNode[] };

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'ghost' | 'danger'> = {
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
  const name = [node.firstName, node.lastName].filter(Boolean).join(' ') || node.employeeId || 'Unnamed';
  const color = avatarColor(name);
  const variant = STATUS_VARIANTS[(node.status || '').toLowerCase()] || 'ghost';
  const hasChildren = node.children.length > 0;

  return (
    <div className={depth > 0 ? 'ml-6 border-l border-zoru-line pl-4 pt-1' : ''}>
      <div className="flex items-start gap-2 py-1.5 group">
        <button
          type="button"
          onClick={() => hasChildren && setExpanded((v) => !v)}
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-zoru-ink-muted transition-colors ${
            hasChildren ? 'hover:text-zoru-ink cursor-pointer' : 'opacity-0 pointer-events-none'
          }`}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] ${color}`}>
          {initials(name)}
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-[13px] text-zoru-ink">{name}</span>
          {node.designationName && <span className="text-[12px] text-zoru-ink-muted">{node.designationName}</span>}
          {node.departmentName && <span className="hidden text-[11px] text-zoru-ink-muted sm:inline">· {node.departmentName}</span>}
          {node.status && <Badge variant={variant}>{node.status}</Badge>}
          {hasChildren && <span className="text-[11px] text-zoru-ink-muted">{node.children.length} report{node.children.length !== 1 ? 's' : ''}</span>}
        </div>
      </div>

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

export function OrgChartClient({ employees }: { employees: Employee[] }) {
  const roots = buildTree(employees);
  const total = employees.length;

  return (
    <Card>
      {roots.length === 0 ? (
        <div className="flex flex-col items-start gap-3 p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zoru-surface-2">
            <Network className="h-6 w-6 text-zoru-ink" strokeWidth={1.75} />
          </div>
          <h3 className="text-[15px] text-zoru-ink">No employees yet</h3>
          <p className="max-w-xl text-[13px] text-zoru-ink-muted">
            Add employees via HR-Payroll → Employees to see the org chart.
          </p>
          <Link href="/dashboard/hrm/hr/directory">
            <Button>
              Open Directory
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] text-zoru-ink-muted">
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
    </Card>
  );
}
