'use client';

/**
 * Client side of the canonical Employees list at
 * `/dashboard/crm/hr-payroll/employees`.
 *
 * Owns:
 *   - the search box (debounced → URL `?q=`)
 *   - the status + employment-type filters
 *   - the KPI strip (passes `kpi` down — computed server-side)
 *   - the data table (employee code, name w/ avatar, department,
 *     designation, joining date, employment type, status, actions)
 *   - the hard-delete confirmation flow via `deleteEmployeeAction`
 *
 * Mirrors the §1D shape used by `<BookingListClient>` so the codebase
 * keeps a single recognizable list pattern across CRM modules. The
 * Rust list endpoint doesn't return a total, so pagination is
 * `hasMore`-driven via `<PaginationBar>`.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  useRouter,
  useSearchParams,
  usePathname,
} from 'next/navigation';
import {
  AlertCircle,
  Download,
  FileSpreadsheet,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import {
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { deleteEmployeeAction } from '@/app/actions/crm/employees.actions';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
} from '@/lib/crm-list-export';

import type { EmployeeListRow } from './types';
import type { EmployeeKpis } from './kpi';

const LIST_BASE = '/dashboard/crm/hr-payroll/employees';

type StatusFilter = 'all' | 'active' | 'on_leave' | 'terminated' | 'resigned';
type TypeFilter =
  | 'all'
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'intern'
  | 'consultant';

interface EmployeesListClientProps {
  rows: EmployeeListRow[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  kpi: EmployeeKpis;
  currentUserId: string | null;
  error?: string;
}

function displayNameOf(row: EmployeeListRow): string {
  if (row.displayName && row.displayName.trim()) return row.displayName.trim();
  const composed = [row.firstName, row.lastName]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(' ')
    .trim();
  if (composed) return composed;
  if (row.employeeId) return row.employeeId;
  return `Employee ${row._id.slice(-6)}`;
}

function avatarInitials(row: EmployeeListRow): string {
  const first = (row.firstName ?? '').trim();
  const last = (row.lastName ?? '').trim();
  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
  }
  const dn = (row.displayName ?? '').trim();
  if (dn) return dn.charAt(0).toUpperCase();
  return '?';
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: 'FT',
  part_time: 'PT',
  contract: 'Contract',
  intern: 'Intern',
  consultant: 'Consultant',
};

function employmentTypeLabel(v?: string): string {
  if (!v) return '—';
  return EMPLOYMENT_TYPE_LABEL[v] ?? v;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  on_leave: 'On leave',
  terminated: 'Terminated',
  resigned: 'Resigned',
  exited: 'Exited',
};

function statusLabel(v?: string): string {
  if (!v) return 'Unknown';
  return STATUS_LABEL[v] ?? v;
}

interface KpiPillProps {
  label: string;
  value: number;
}

function KpiPill({ label, value }: KpiPillProps) {
  return (
    <div className="flex flex-col rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </span>
      <span className="text-[15px] font-semibold text-zoru-ink">{value}</span>
    </div>
  );
}

export function EmployeesListClient({
  rows,
  page,
  limit,
  hasMore,
  initialQuery,
  kpi,
  error,
}: EmployeesListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all');

  const [pendingDelete, setPendingDelete] =
    React.useState<EmployeeListRow | null>(null);
  const [, startDelete] = React.useTransition();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkDeleting, startBulkDelete] = React.useTransition();
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);

  // Debounce search → URL.
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      const trimmed = query.trim();
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.employmentType !== typeFilter) return false;
      if (!needle) return true;
      const hay = [
        r.employeeId ?? '',
        r.firstName ?? '',
        r.lastName ?? '',
        r.displayName ?? '',
        r.workEmail ?? '',
        r.workPhone ?? '',
        r.designation ?? '',
        r.workLocation ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, query, statusFilter, typeFilter]);

  const hasActiveFilters =
    !!query.trim() || statusFilter !== 'all' || typeFilter !== 'all';

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (all: boolean) =>
    setSelected(all ? new Set(filtered.map((r) => r._id)) : new Set());

  const headChecked =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    const label = displayNameOf(pendingDelete);
    startDelete(async () => {
      const res = await deleteEmployeeAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const runBulkDelete = () => {
    if (selected.size === 0) return;
    setBulkConfirmOpen(false);
    const ids = Array.from(selected);
    startBulkDelete(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await deleteEmployeeAction(id);
        if (res.success) ok += 1;
        else failed += 1;
      }
      toast({
        title:
          failed === 0
            ? `${ok} employee${ok === 1 ? '' : 's'} deleted`
            : `${ok} deleted · ${failed} failed`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      setSelected(new Set());
      router.refresh();
    });
  };

  const EXPORT_HEADERS = [
    'Employee ID',
    'First name',
    'Last name',
    'Display name',
    'Work email',
    'Work phone',
    'Department',
    'Designation',
    'Employment type',
    'Status',
    'Joining date',
    'Work location',
  ];

  function toExportRow(r: EmployeeListRow) {
    return {
      'Employee ID': r.employeeId ?? '',
      'First name': r.firstName ?? '',
      'Last name': r.lastName ?? '',
      'Display name': r.displayName ?? displayNameOf(r),
      'Work email': r.workEmail ?? '',
      'Work phone': r.workPhone ?? '',
      Department: r.departmentId ?? '',
      Designation: r.designation ?? '',
      'Employment type': employmentTypeLabel(r.employmentType),
      Status: statusLabel(r.status),
      'Joining date': fmtDate(r.joiningDate),
      'Work location': r.workLocation ?? '',
    };
  }

  const exportRows = React.useMemo(() => {
    const ids = selected.size > 0 ? selected : null;
    const src = ids
      ? filtered.filter((r) => ids.has(r._id))
      : filtered;
    return src.map(toExportRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selected]);

  const handleExportCsv = () => {
    downloadCsv(
      `employees-${dateStamp()}.csv`,
      EXPORT_HEADERS,
      exportRows,
    );
  };

  const handleExportXlsx = () => {
    void downloadXlsx(
      `employees-${dateStamp()}.xlsx`,
      EXPORT_HEADERS,
      exportRows,
      'Employees',
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiPill label="Total" value={kpi.total} />
        <KpiPill label="Active" value={kpi.active} />
        <KpiPill label="On leave" value={kpi.onLeave} />
        <KpiPill label="Exited" value={kpi.exited} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <ZoruInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, code, email…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>

        <ZoruSelect
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
            <ZoruSelectValue placeholder="All statuses" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
            <ZoruSelectItem value="active">Active</ZoruSelectItem>
            <ZoruSelectItem value="on_leave">On leave</ZoruSelectItem>
            <ZoruSelectItem value="terminated">Terminated</ZoruSelectItem>
            <ZoruSelectItem value="resigned">Resigned</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>

        <ZoruSelect
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as TypeFilter)}
        >
          <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
            <ZoruSelectValue placeholder="All types" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All types</ZoruSelectItem>
            <ZoruSelectItem value="full_time">Full-time</ZoruSelectItem>
            <ZoruSelectItem value="part_time">Part-time</ZoruSelectItem>
            <ZoruSelectItem value="contract">Contract</ZoruSelectItem>
            <ZoruSelectItem value="intern">Intern</ZoruSelectItem>
            <ZoruSelectItem value="consultant">Consultant</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>

        {hasActiveFilters ? (
          <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </ZoruButton>
        ) : null}

        <div className="ml-auto">
          <ZoruButton asChild size="sm">
            <Link href={`${LIST_BASE}/new`}>
              <Plus className="h-3.5 w-3.5" /> New employee
            </Link>
          </ZoruButton>
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
          <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
            <ListChecks className="h-4 w-4 text-zoru-primary" />
            {selected.size} selected
          </div>
          <div className="flex items-center gap-1">
            <ZoruButton
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              aria-label="Export selection as CSV"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </ZoruButton>
            <ZoruButton
              size="sm"
              variant="outline"
              onClick={handleExportXlsx}
              aria-label="Export selection as XLSX"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> XLSX
            </ZoruButton>
            <ZoruButton
              size="sm"
              variant="destructive"
              onClick={() => setBulkConfirmOpen(true)}
              disabled={bulkDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </ZoruButton>
            <ZoruButton
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </ZoruButton>
          </div>
        </div>
      ) : null}

      <ZoruCard className="overflow-hidden p-0">
        {error ? (
          <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <ZoruTable>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead className="w-8">
                <ZoruCheckbox
                  checked={headChecked}
                  onCheckedChange={(c) => toggleAll(Boolean(c))}
                  aria-label="Select all"
                />
              </ZoruTableHead>
              <ZoruTableHead>Code</ZoruTableHead>
              <ZoruTableHead>Name</ZoruTableHead>
              <ZoruTableHead>Department</ZoruTableHead>
              <ZoruTableHead>Designation</ZoruTableHead>
              <ZoruTableHead>Joining date</ZoruTableHead>
              <ZoruTableHead>Type</ZoruTableHead>
              <ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filtered.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell
                  colSpan={9}
                  className="h-24 text-center text-[13px] text-zoru-ink-muted"
                >
                  {hasActiveFilters
                    ? 'No employees match these filters.'
                    : 'No employees yet — click "New employee" to add one.'}
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              filtered.map((r) => {
                const id = r._id;
                const checked = selected.has(id);
                const name = displayNameOf(r);
                const photoUrl = r.photoFileId
                  ? `/api/sabfiles/raw/${r.photoFileId}`
                  : undefined;
                return (
                  <ZoruTableRow key={id}>
                    <ZoruTableCell>
                      <ZoruCheckbox
                        checked={checked}
                        onCheckedChange={() => toggleOne(id)}
                        aria-label={`Select ${name}`}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                      {r.employeeId ?? '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex items-center gap-2">
                        <ZoruAvatar className="h-8 w-8">
                          {photoUrl ? (
                            <ZoruAvatarImage src={photoUrl} alt={name} />
                          ) : null}
                          <ZoruAvatarFallback>
                            {avatarInitials(r)}
                          </ZoruAvatarFallback>
                        </ZoruAvatar>
                        <EntityRowLink
                          href={`${LIST_BASE}/${id}`}
                          label={name}
                          subtitle={r.designation || r.employeeId}
                        />
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                      {r.departmentId ? r.departmentId : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                      {r.designation ?? '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                      {fmtDate(r.joiningDate)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                      {employmentTypeLabel(r.employmentType)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <StatusPill
                        label={statusLabel(r.status)}
                        tone={statusToTone(r.status)}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ZoruButton size="sm" variant="ghost" asChild>
                          <Link href={`${LIST_BASE}/${id}/edit`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </ZoruButton>
                        <ZoruButton
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingDelete(r)}
                          className="text-zoru-danger-ink"
                          aria-label={`Delete ${name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ZoruButton>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })
            )}
          </ZoruTableBody>
        </ZoruTable>

        <PaginationBar page={page} limit={limit} hasMore={hasMore} />
      </ZoruCard>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete employee?"
        description={
          pendingDelete
            ? `This permanently removes ${displayNameOf(pendingDelete)} from your directory.`
            : ''
        }
        confirmLabel="Delete"
        confirmTone="danger"
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        title={`Delete ${selected.size} employee${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected rows from your directory. This action cannot be undone."
        confirmLabel="Delete all"
        confirmTone="danger"
        onConfirm={runBulkDelete}
      />
    </div>
  );
}
