'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Users,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Search,
  LayoutGrid,
  List,
} from 'lucide-react';
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
  email?: string;
  phone?: string;
  departmentName?: string;
  designationName?: string;
  workLocation?: string;
  joiningDate?: string | Date;
  status?: string;
  [k: string]: any;
};

const STATUS_TONES: Record<string, 'green' | 'amber' | 'neutral' | 'red'> = {
  active: 'green',
  inactive: 'neutral',
  terminated: 'red',
  probation: 'amber',
  notice: 'amber',
};

function initials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtDate(v: unknown): string {
  if (!v) return '';
  const d = new Date(v as any);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Stable avatar color per employee based on first letter
const AVATAR_COLORS = [
  'bg-accent text-accent-foreground',
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Employee Directory"
        subtitle="A read-only view of every employee in your organization."
        icon={Users}
        actions={
          <Link href="/dashboard/hrm/payroll/employees">
            <ClayButton
              variant="obsidian"
              trailing={<ArrowRight className="h-4 w-4" strokeWidth={1.75} />}
            >
              Manage Employees
            </ClayButton>
          </Link>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, title, department…"
            className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-1">
          <ClayButton
            variant={view === 'grid' ? 'obsidian' : 'pill'}
            size="sm"
            onClick={() => setView('grid')}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </ClayButton>
          <ClayButton
            variant={view === 'list' ? 'obsidian' : 'pill'}
            size="sm"
            onClick={() => setView('list')}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </ClayButton>
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
        <ClayCard>
          <div className="flex flex-col items-start gap-3 p-8">
            <h3 className="text-[15px] font-semibold text-foreground">No employees found</h3>
            <p className="max-w-xl text-[13px] text-muted-foreground">
              {q
                ? `No results match "${search}". Try a different search term.`
                : 'Employee data will appear here once added via HR-Payroll → Employees.'}
            </p>
            {!q && (
              <Link href="/dashboard/hrm/payroll/employees">
                <ClayButton
                  variant="obsidian"
                  trailing={<ArrowRight className="h-4 w-4" strokeWidth={1.75} />}
                >
                  Go to Employees
                </ClayButton>
              </Link>
            )}
          </div>
        </ClayCard>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((e) => {
            const name =
              [e.firstName, e.lastName].filter(Boolean).join(' ') ||
              e.employeeId ||
              'Unnamed';
            const color = avatarColor(name);
            const tone = STATUS_TONES[(e.status || '').toLowerCase()] || 'neutral';
            return (
              <ClayCard key={e._id}>
                <div className="flex flex-col gap-3 p-4">
                  {/* Avatar + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${color}`}
                    >
                      {initials(name)}
                    </div>
                    {e.status && (
                      <ClayBadge tone={tone} dot>
                        {e.status}
                      </ClayBadge>
                    )}
                  </div>

                  {/* Name + title */}
                  <div>
                    <div className="text-[14px] font-semibold text-foreground leading-snug">
                      {name}
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      {e.designationName || '—'}
                    </div>
                    {e.departmentName && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {e.departmentName}
                      </div>
                    )}
                  </div>

                  {/* Contact + meta */}
                  <div className="flex flex-col gap-1 pt-1 border-t border-border">
                    {e.email && (
                      <a
                        href={`mailto:${e.email}`}
                        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground truncate"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{e.email}</span>
                      </a>
                    )}
                    {e.phone && (
                      <a
                        href={`tel:${e.phone}`}
                        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        {e.phone}
                      </a>
                    )}
                    {e.workLocation && (
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        {e.workLocation}
                      </div>
                    )}
                    {e.joiningDate && (
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        Joined {fmtDate(e.joiningDate)}
                      </div>
                    )}
                  </div>
                </div>
              </ClayCard>
            );
          })}
        </div>
      ) : (
        /* List view — native table */
        <ClayCard>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  {['Employee', 'Designation', 'Department', 'Email', 'Phone', 'Location', 'Joined', 'Status'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((e) => {
                  const name =
                    [e.firstName, e.lastName].filter(Boolean).join(' ') ||
                    e.employeeId ||
                    'Unnamed';
                  const color = avatarColor(name);
                  const tone = STATUS_TONES[(e.status || '').toLowerCase()] || 'neutral';
                  return (
                    <tr key={e._id} className="transition-colors hover:bg-secondary">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${color}`}
                          >
                            {initials(name)}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{name}</div>
                            {e.employeeId && (
                              <div className="text-[11px] text-muted-foreground">{e.employeeId}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{e.designationName || '—'}</td>
                      <td className="px-4 py-3 text-foreground">{e.departmentName || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {e.email ? (
                          <a href={`mailto:${e.email}`} className="hover:text-foreground truncate max-w-[160px] block">
                            {e.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.phone || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.workLocation || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {fmtDate(e.joiningDate) || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {e.status ? (
                          <ClayBadge tone={tone} dot>
                            {e.status}
                          </ClayBadge>
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
        </ClayCard>
      )}

      {/* Result count */}
      {!isLoading && allRows.length > 0 && (
        <p className="text-[12px] text-muted-foreground">
          Showing {rows.length} of {allRows.length} employee{allRows.length !== 1 ? 's' : ''}
          {q ? ` matching "${search}"` : ''}
        </p>
      )}
    </div>
  );
}
