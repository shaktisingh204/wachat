'use client';
import { fmtDate } from '@/lib/utils';

import { Badge, Button, Card, Input, Skeleton } from '@/components/zoruui';
import {
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Search,
  LayoutGrid,
  List,
  } from 'lucide-react';
import { useEffect,
  useState,
  useTransition } from 'react';

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
  [k: string]: any;
};

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

function initials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}



// Stable avatar color per employee based on first letter
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

export default function DirectoryPage() {
  const [allRows, setAllRows] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
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

  const q = search.trim().toLowerCase();
  const rows = q
    ? allRows.filter((e) => {
        const name = [e.firstName, e.lastName].filter(Boolean).join(' ').toLowerCase();
        return (
          name.includes(q) ||
          (e.email || '').toLowerCase().includes(q) ||
          (e.designationName || '').toLowerCase().includes(q) ||
          (e.departmentName || '').toLowerCase().includes(q) ||
          (e.employeeId || '').toLowerCase().includes(q)
        );
      })
    : allRows;

  const empty = !isLoading && rows.length === 0;

  return (
    <EntityListShell
      title="Employee Directory"
      subtitle="A read-only view of every employee in your organization."
      primaryAction={
        <Link href="/dashboard/hrm/payroll/employees">
          <Button>
            Manage Employees
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </Link>
      }
    >

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, title, department…"
            leadingSlot={<Search />}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={view === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('grid')}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('list')}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
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
            <Skeleton key={i} className={view === 'grid' ? 'h-48 w-full rounded-lg' : 'h-16 w-full'} />
          ))}
        </div>
      ) : empty || failed ? (
        <Card>
          <div className="flex flex-col items-start gap-3 p-8">
            <h3 className="text-[15px] text-zoru-ink">No employees found</h3>
            <p className="max-w-xl text-[13px] text-zoru-ink-muted">
              {q
                ? `No results match "${search}". Try a different search term.`
                : 'Employee data will appear here once added via HR-Payroll → Employees.'}
            </p>
            {!q && (
              <Link href="/dashboard/hrm/payroll/employees">
                <Button>
                  Go to Employees
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((e) => {
            const name =
              [e.firstName, e.lastName].filter(Boolean).join(' ') ||
              e.employeeId ||
              'Unnamed';
            const color = avatarColor(name);
            const variant = STATUS_VARIANTS[(e.status || '').toLowerCase()] || 'ghost';
            return (
              <Card key={e._id}>
                <div className="flex flex-col gap-3 p-4">
                  {/* Avatar + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] ${color}`}
                    >
                      {initials(name)}
                    </div>
                    {e.status && (
                      <Badge variant={variant}>
                        {e.status}
                      </Badge>
                    )}
                  </div>

                  {/* Name + title */}
                  <div>
                    <div className="text-[14px] text-zoru-ink leading-snug">
                      {name}
                    </div>
                    <div className="mt-0.5 text-[12px] text-zoru-ink-muted">
                      {e.designationName || '—'}
                    </div>
                    {e.departmentName && (
                      <div className="mt-0.5 text-[11px] text-zoru-ink-muted">
                        {e.departmentName}
                      </div>
                    )}
                  </div>

                  {/* Contact + meta */}
                  <div className="flex flex-col gap-1 pt-1 border-t border-zoru-line">
                    {e.email && (
                      <a
                        href={`mailto:${e.email}`}
                        className="inline-flex items-center gap-1.5 text-[12px] text-zoru-ink-muted hover:text-zoru-ink truncate"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{e.email}</span>
                      </a>
                    )}
                    {e.phone && (
                      <a
                        href={`tel:${e.phone}`}
                        className="inline-flex items-center gap-1.5 text-[12px] text-zoru-ink-muted hover:text-zoru-ink"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        {e.phone}
                      </a>
                    )}
                    {e.workLocation && (
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-zoru-ink-muted">
                        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        {e.workLocation}
                      </div>
                    )}
                    {e.joiningDate && (
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-zoru-ink-muted">
                        <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        Joined {fmtDate(e.joiningDate)}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List view — native table */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line">
                  {['Employee', 'Designation', 'Department', 'Email', 'Phone', 'Location', 'Joined', 'Status'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[11px] uppercase tracking-wide text-zoru-ink-muted whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zoru-line">
                {rows.map((e) => {
                  const name =
                    [e.firstName, e.lastName].filter(Boolean).join(' ') ||
                    e.employeeId ||
                    'Unnamed';
                  const color = avatarColor(name);
                  const variant = STATUS_VARIANTS[(e.status || '').toLowerCase()] || 'ghost';
                  return (
                    <tr key={e._id} className="transition-colors hover:bg-zoru-surface-2">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] ${color}`}
                          >
                            {initials(name)}
                          </div>
                          <div>
                            <div className="text-zoru-ink">{name}</div>
                            {e.employeeId && (
                              <div className="text-[11px] text-zoru-ink-muted">{e.employeeId}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zoru-ink">{e.designationName || '—'}</td>
                      <td className="px-4 py-3 text-zoru-ink">{e.departmentName || '—'}</td>
                      <td className="px-4 py-3 text-zoru-ink-muted">
                        {e.email ? (
                          <a href={`mailto:${e.email}`} className="hover:text-zoru-ink truncate max-w-[160px] block">
                            {e.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-zoru-ink-muted">{e.phone || '—'}</td>
                      <td className="px-4 py-3 text-zoru-ink-muted">{e.workLocation || '—'}</td>
                      <td className="px-4 py-3 text-zoru-ink-muted whitespace-nowrap">
                        {fmtDate(e.joiningDate) || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {e.status ? (
                          <Badge variant={variant}>
                            {e.status}
                          </Badge>
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
        </Card>
      )}

      {/* Result count */}
      {!isLoading && allRows.length > 0 && (
        <p className="text-[12px] text-zoru-ink-muted">
          Showing {rows.length} of {allRows.length} employee{allRows.length !== 1 ? 's' : ''}
          {q ? ` matching "${search}"` : ''}
        </p>
      )}
    </EntityListShell>
  );
}
