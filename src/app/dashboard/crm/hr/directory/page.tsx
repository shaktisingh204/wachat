'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
} from '@/components/zoruui';
import {
  ArrowRight,
  Calendar,
  Download,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Phone,
  Search,
} from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';

type Employee = {
  _id: string;
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  email?: string;
  phone?: string;
  departmentName?: string;
  designationName?: string;
  workLocation?: string;
  joiningDate?: string | Date;
  status?: string;
};

interface DirectoryKpis {
  total: number;
  departments: number;
  active: number;
  remote: number;
}

const STATUS_VARIANTS: Record<
  string,
  'success' | 'warning' | 'ghost' | 'danger'
> = {
  active: 'success',
  inactive: 'ghost',
  terminated: 'danger',
  probation: 'warning',
  notice: 'warning',
};

function initials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function fmtDate(v: unknown): string {
  if (!v) return '';
  const d = new Date(v as string | Date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

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

function employeeName(e: Employee): string {
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.employeeId || 'Unnamed';
}

export default function DirectoryPage(): React.JSX.Element {
  const [allRows, setAllRows] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [statusFilterDir, setStatusFilterDir] = useState<string>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [isLoading, startLoading] = useTransition();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    startLoading(async () => {
      try {
        const list = await getCrmEmployees();
        setAllRows(Array.isArray(list) ? (list as Employee[]) : []);
      } catch (e) {
        console.error('Failed to load employees:', e);
        setFailed(true);
      }
    });
  }, []);

  /* ── KPIs ────────────────────────────────────────────────────── */

  const kpis = React.useMemo((): DirectoryKpis => {
    const depts = new Set<string>();
    let active = 0;
    let remote = 0;
    for (const e of allRows) {
      if (e.departmentName) depts.add(e.departmentName);
      if (String(e.status ?? '').toLowerCase() === 'active') active += 1;
      const loc = String(e.workLocation ?? '').toLowerCase();
      if (loc.includes('remote') || loc.includes('wfh')) remote += 1;
    }
    return { total: allRows.length, departments: depts.size, active, remote };
  }, [allRows]);

  /* ── department options (derived from data) ─────────────────── */

  const deptOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of allRows) {
      if (e.departmentName) set.add(e.departmentName);
    }
    return Array.from(set).sort();
  }, [allRows]);

  /* ── filtered rows ────────────────────────────────────────────── */

  const q = search.trim().toLowerCase();
  const rows = React.useMemo(
    () =>
      allRows.filter((e) => {
        if (deptFilter !== 'all' && e.departmentName !== deptFilter) return false;
        if (
          statusFilterDir !== 'all' &&
          String(e.status ?? '').toLowerCase() !== statusFilterDir
        ) {
          return false;
        }
        if (!q) return true;
        const name = employeeName(e).toLowerCase();
        return (
          name.includes(q) ||
          (e.email ?? '').toLowerCase().includes(q) ||
          (e.designationName ?? '').toLowerCase().includes(q) ||
          (e.departmentName ?? '').toLowerCase().includes(q) ||
          (e.employeeId ?? '').toLowerCase().includes(q)
        );
      }),
    [allRows, deptFilter, statusFilterDir, q],
  );

  const empty = !isLoading && rows.length === 0;

  /* ── export ──────────────────────────────────────────────────── */

  const handleExportCsv = (): void => {
    downloadCsv(
      `employee-directory-${dateStamp()}.csv`,
      ['name', 'employeeId', 'designation', 'department', 'email', 'phone', 'location', 'joined', 'status'],
      rows.map((e) => ({
        name: employeeName(e),
        employeeId: e.employeeId ?? '',
        designation: e.designationName ?? '',
        department: e.departmentName ?? '',
        email: e.email ?? '',
        phone: e.phone ?? '',
        location: e.workLocation ?? '',
        joined: fmtDate(e.joiningDate),
        status: e.status ?? '',
      })),
    );
  };

  return (
    <EntityListShell
      title="Employee Directory"
      subtitle="A read-only view of every employee in your organization."
      primaryAction={
        <div className="flex items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </ZoruButton>
          <Link href="/dashboard/hrm/payroll/employees">
            <ZoruButton>
              Manage Employees
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </ZoruButton>
          </Link>
        </div>
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
          <p className="text-xs text-zoru-ink-muted">Active</p>
          <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.active}</p>
        </ZoruCard>
        <ZoruCard className="p-3">
          <p className="text-xs text-zoru-ink-muted">Remote</p>
          <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.remote}</p>
        </ZoruCard>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <ZoruInput
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, title, department…"
            leadingSlot={<Search />}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Department filter */}
          <ZoruSelect value={deptFilter} onValueChange={setDeptFilter}>
            <ZoruSelectTrigger className="h-9 w-[180px]">
              <ZoruSelectValue placeholder="Department" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All departments</ZoruSelectItem>
              {deptOptions.map((d) => (
                <ZoruSelectItem key={d} value={d}>
                  {d}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>

          {/* Status filter */}
          <ZoruSelect value={statusFilterDir} onValueChange={setStatusFilterDir}>
            <ZoruSelectTrigger className="h-9 w-[150px]">
              <ZoruSelectValue placeholder="Status" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
              <ZoruSelectItem value="active">Active</ZoruSelectItem>
              <ZoruSelectItem value="probation">Probation</ZoruSelectItem>
              <ZoruSelectItem value="notice">Notice</ZoruSelectItem>
              <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
              <ZoruSelectItem value="terminated">Terminated</ZoruSelectItem>
            </ZoruSelectContent>
          </ZoruSelect>

          {/* View toggle */}
          <div className="flex items-center gap-1">
            <ZoruButton
              variant={view === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('grid')}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </ZoruButton>
            <ZoruButton
              variant={view === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('list')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </ZoruButton>
          </div>
        </div>
      </div>

      {isLoading && allRows.length === 0 ? (
        <div
          className={
            view === 'grid'
              ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'flex flex-col gap-2'
          }
        >
          {[...Array(8)].map((_, i) => (
            <ZoruSkeleton
              key={i}
              className={view === 'grid' ? 'h-48 w-full rounded-lg' : 'h-16 w-full'}
            />
          ))}
        </div>
      ) : empty || failed ? (
        <ZoruCard>
          <div className="flex flex-col items-start gap-3 p-8">
            <h3 className="text-[15px] text-zoru-ink">No employees found</h3>
            <p className="max-w-xl text-[13px] text-zoru-ink-muted">
              {q
                ? `No results match "${search}". Try a different search term.`
                : 'Employee data will appear here once added via HR-Payroll → Employees.'}
            </p>
            {!q && (
              <Link href="/dashboard/hrm/payroll/employees">
                <ZoruButton>
                  Go to Employees
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </ZoruButton>
              </Link>
            )}
          </div>
        </ZoruCard>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((e) => {
            const name = employeeName(e);
            const color = avatarColor(name);
            const variant =
              STATUS_VARIANTS[String(e.status ?? '').toLowerCase()] ?? 'ghost';
            return (
              <ZoruCard key={e._id}>
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] ${color}`}
                    >
                      {initials(name)}
                    </div>
                    {e.status ? (
                      <ZoruBadge variant={variant}>{e.status}</ZoruBadge>
                    ) : null}
                  </div>

                  <div>
                    <div className="text-[14px] text-zoru-ink leading-snug">{name}</div>
                    <div className="mt-0.5 text-[12px] text-zoru-ink-muted">
                      {e.designationName || '—'}
                    </div>
                    {e.departmentName ? (
                      <div className="mt-0.5 text-[11px] text-zoru-ink-muted">
                        {e.departmentName}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-1 pt-1 border-t border-zoru-line">
                    {e.email ? (
                      <a
                        href={`mailto:${e.email}`}
                        className="inline-flex items-center gap-1.5 text-[12px] text-zoru-ink-muted hover:text-zoru-ink truncate"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{e.email}</span>
                      </a>
                    ) : null}
                    {e.phone ? (
                      <a
                        href={`tel:${e.phone}`}
                        className="inline-flex items-center gap-1.5 text-[12px] text-zoru-ink-muted hover:text-zoru-ink"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        {e.phone}
                      </a>
                    ) : null}
                    {e.workLocation ? (
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-zoru-ink-muted">
                        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        {e.workLocation}
                      </div>
                    ) : null}
                    {e.joiningDate ? (
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-zoru-ink-muted">
                        <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        Joined {fmtDate(e.joiningDate)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </ZoruCard>
            );
          })}
        </div>
      ) : (
        <ZoruCard>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line">
                  {[
                    'Employee',
                    'Designation',
                    'Department',
                    'Email',
                    'Phone',
                    'Location',
                    'Joined',
                    'Status',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[11px] uppercase tracking-wide text-zoru-ink-muted whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zoru-line">
                {rows.map((e) => {
                  const name = employeeName(e);
                  const color = avatarColor(name);
                  const variant =
                    STATUS_VARIANTS[String(e.status ?? '').toLowerCase()] ?? 'ghost';
                  return (
                    <tr
                      key={e._id}
                      className="transition-colors hover:bg-zoru-surface-2"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] ${color}`}
                          >
                            {initials(name)}
                          </div>
                          <div>
                            <div className="text-zoru-ink">{name}</div>
                            {e.employeeId ? (
                              <div className="text-[11px] text-zoru-ink-muted">
                                {e.employeeId}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zoru-ink">
                        {e.designationName || '—'}
                      </td>
                      <td className="px-4 py-3 text-zoru-ink">
                        {e.departmentName || '—'}
                      </td>
                      <td className="px-4 py-3 text-zoru-ink-muted">
                        {e.email ? (
                          <a
                            href={`mailto:${e.email}`}
                            className="hover:text-zoru-ink truncate max-w-[160px] block"
                          >
                            {e.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-zoru-ink-muted">
                        {e.phone || '—'}
                      </td>
                      <td className="px-4 py-3 text-zoru-ink-muted">
                        {e.workLocation || '—'}
                      </td>
                      <td className="px-4 py-3 text-zoru-ink-muted whitespace-nowrap">
                        {fmtDate(e.joiningDate) || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {e.status ? (
                          <ZoruBadge variant={variant}>{e.status}</ZoruBadge>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ZoruCard>
      )}

      {!isLoading && allRows.length > 0 ? (
        <p className="text-[12px] text-zoru-ink-muted">
          Showing {rows.length} of {allRows.length} employee
          {allRows.length !== 1 ? 's' : ''}
          {q ? ` matching "${search}"` : ''}
        </p>
      ) : null}
    </EntityListShell>
  );
}
