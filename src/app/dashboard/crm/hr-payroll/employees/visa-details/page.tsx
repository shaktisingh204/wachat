'use client';

/**
 * Visa Details — deepened list per Deep template (ref
 * src/app/dashboard/crm/hr-payroll/employees/teams/page.tsx).
 *
 * Composition:
 *   <EntityListShell>
 *     - KPI strip (total holders, expiring 90d, expired, top country)
 *     - Filter row (search + department + status + date range)
 *     - Bulk action bar (bulk delete + bulk archive + bulk export)
 *     - CSV / XLSX export (all or selection) via src/lib/crm-list-export.ts
 *     - Pagination via <PaginationBar>
 *     - <EntityRowLink> on primary cell linking to the employee
 *     - <ConfirmDialog> for single + bulk delete
 *
 * Multi-tenant via getSession() inside the underlying server actions.
 */

import * as React from 'react';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  Archive,
  CalendarClock,
  Download,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Pencil,
  Plus,
  Stamp,
  Trash2,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { format } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  deleteVisaDetail,
  getVisaDetails,
  saveVisaDetail,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsVisaDetail } from '@/lib/worksuite/hr-ext-types';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

type VisaRow = WsVisaDetail & { _id: string };
type EmployeeLite = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  departmentName?: string;
  status?: string;
};
type StatusFilter = 'all' | 'expired' | 'expiring-90d' | 'valid' | 'no-expiry';

type FormState = {
  _id: string;
  user_id: string;
  country: string;
  visa_number: string;
  issue_date: string;
  expiry_date: string;
  file: string;
};

const EMPTY_FORM: FormState = {
  _id: '',
  user_id: '',
  country: '',
  visa_number: '',
  issue_date: '',
  expiry_date: '',
  file: '',
};
const ROWS_PER_PAGE = 20;

function toDate(v: any): Date | null {
  if (!v) return null;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function toDateInput(v: any): string {
  const d = toDate(v);
  return d ? d.toISOString().slice(0, 10) : '';
}

function fmtDate(v: any): string {
  const d = toDate(v);
  if (!d) return '—';
  try {
    return format(d, 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

function expiryStatus(v: any): 'expired' | 'soon-90' | 'ok' | 'none' {
  const d = toDate(v);
  if (!d) return 'none';
  const diff = (d.getTime() - Date.now()) / 86_400_000;
  if (diff < 0) return 'expired';
  if (diff < 90) return 'soon-90';
  return 'ok';
}

function expiryVariant(status: ReturnType<typeof expiryStatus>): 'danger' | 'warning' | 'success' | 'secondary' {
  if (status === 'expired') return 'danger';
  if (status === 'soon-90') return 'warning';
  if (status === 'ok') return 'success';
  return 'secondary';
}

export default function VisaDetailsPage() {
  const { toast } = useZoruToast();

  const [visas, setVisas] = React.useState<VisaRow[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeLite[]>([]);

  const [isLoading, startLoad] = React.useTransition();
  const [isSaving, startSave] = React.useTransition();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);

  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [countryFilter, setCountryFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');
  const [page, setPage] = React.useState(1);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = React.useState(false);

  const load = React.useCallback(() => {
    startLoad(async () => {
      const [vs, es] = await Promise.all([getVisaDetails(), getCrmEmployees()]);
      setVisas(vs as VisaRow[]);
      setEmployees(
        (es as any[]).map((e) => ({
          _id: String(e._id),
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          departmentName: e.departmentName,
          status: e.status,
        })),
      );
      setSelected(new Set());
    });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const employeeMap = React.useMemo(() => {
    const m = new Map<string, EmployeeLite>();
    for (const e of employees) m.set(e._id, e);
    return m;
  }, [employees]);

  const empName = React.useCallback(
    (id?: string) => {
      if (!id) return '';
      const e = employeeMap.get(String(id));
      if (!e) return String(id);
      return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.email || 'Unnamed';
    },
    [employeeMap],
  );

  const debouncedSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const departments = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) if (e.departmentName) set.add(e.departmentName);
    return Array.from(set).sort();
  }, [employees]);

  const countries = React.useMemo(() => {
    const set = new Set<string>();
    for (const v of visas) if (v.country) set.add(v.country);
    return Array.from(set).sort();
  }, [visas]);

  const filteredVisas = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86_400_000 - 1 : null;
    return visas.filter((v) => {
      const emp = employeeMap.get(String(v.user_id));
      if (q) {
        const haystack = [v.country, v.visa_number, empName(v.user_id), emp?.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (departmentFilter !== 'all' && emp?.departmentName !== departmentFilter) return false;
      if (countryFilter !== 'all' && v.country !== countryFilter) return false;
      const exp = expiryStatus(v.expiry_date);
      switch (statusFilter) {
        case 'expired':
          if (exp !== 'expired') return false;
          break;
        case 'expiring-90d':
          if (exp !== 'soon-90') return false;
          break;
        case 'valid':
          if (exp !== 'ok') return false;
          break;
        case 'no-expiry':
          if (exp !== 'none') return false;
          break;
      }
      const issue = toDate(v.issue_date);
      if (issue) {
        if (fromTs && issue.getTime() < fromTs) return false;
        if (toTs && issue.getTime() > toTs) return false;
      } else if (fromTs || toTs) {
        return false;
      }
      return true;
    });
  }, [
    visas,
    search,
    departmentFilter,
    countryFilter,
    statusFilter,
    dateFrom,
    dateTo,
    employeeMap,
    empName,
  ]);

  const total = filteredVisas.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const pageRows = React.useMemo(
    () => filteredVisas.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [filteredVisas, page],
  );

  // KPIs over the filtered set.
  const kpis = React.useMemo(() => {
    const holderSet = new Set<string>();
    let expired = 0;
    let expiring90 = 0;
    const countryCounts = new Map<string, number>();
    for (const v of filteredVisas) {
      holderSet.add(String(v.user_id));
      const exp = expiryStatus(v.expiry_date);
      if (exp === 'expired') expired += 1;
      else if (exp === 'soon-90') expiring90 += 1;
      const c = v.country || 'Unknown';
      countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
    }
    let topCountry: { name: string; count: number } | null = null;
    for (const [name, count] of countryCounts) {
      if (!topCountry || count > topCountry.count) topCountry = { name, count };
    }
    return {
      totalHolders: holderSet.size,
      expiring90,
      expired,
      topCountry,
      countryCount: countryCounts.size,
    };
  }, [filteredVisas]);

  // ── Form helpers ───────────────────────────────────────────────────
  const openAdd = React.useCallback(() => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((v: VisaRow) => {
    setForm({
      _id: String(v._id),
      user_id: String(v.user_id),
      country: v.country,
      visa_number: v.visa_number ?? '',
      issue_date: toDateInput(v.issue_date),
      expiry_date: toDateInput(v.expiry_date),
      file: v.file ?? '',
    });
    setDialogOpen(true);
  }, []);

  const handleSave = React.useCallback(() => {
    if (!form.user_id) {
      toast({ title: 'Select an employee', variant: 'destructive' });
      return;
    }
    if (!form.country.trim()) {
      toast({ title: 'Country is required', variant: 'destructive' });
      return;
    }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('user_id', form.user_id);
      fd.append('country', form.country);
      fd.append('visa_number', form.visa_number);
      if (form.issue_date) fd.append('issue_date', form.issue_date);
      if (form.expiry_date) fd.append('expiry_date', form.expiry_date);
      fd.append('file', form.file);
      const res = await saveVisaDetail(null, fd);
      if (res?.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: form._id ? 'Updated' : 'Created' });
      setDialogOpen(false);
      load();
    });
  }, [form, load, toast]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      const res = await deleteVisaDetail(id);
      if ((res as any)?.error) {
        toast({
          title: 'Delete failed',
          description: (res as any).error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Visa deleted' });
      load();
    },
    [load, toast],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteTargetId) return;
    await handleDelete(deleteTargetId);
    setDeleteTargetId(null);
  }, [deleteTargetId, handleDelete]);

  const handleBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let ok = 0;
    for (const id of ids) {
      const res = await deleteVisaDetail(id);
      if (!(res as any)?.error) ok += 1;
    }
    toast({ title: `${ok} visa${ok === 1 ? '' : 's'} deleted` });
    setBulkDeleteOpen(false);
    setSelected(new Set());
    load();
  }, [selected, load, toast]);

  // Archive = set expiry_date to today + tag country with [archived] prefix.
  const handleBulkArchive = React.useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let ok = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const id of ids) {
      const v = visas.find((x) => String(x._id) === id);
      if (!v) continue;
      const fd = new FormData();
      fd.append('_id', id);
      fd.append('user_id', String(v.user_id));
      fd.append(
        'country',
        v.country.toLowerCase().startsWith('[archived]')
          ? v.country
          : `[archived] ${v.country}`,
      );
      fd.append('visa_number', v.visa_number ?? '');
      if (v.issue_date) fd.append('issue_date', toDateInput(v.issue_date));
      fd.append('expiry_date', today);
      fd.append('file', v.file ?? '');
      const res = await saveVisaDetail(null, fd);
      if (!res?.error) ok += 1;
    }
    toast({ title: `${ok} visa${ok === 1 ? '' : 's'} archived` });
    setBulkArchiveOpen(false);
    setSelected(new Set());
    load();
  }, [selected, visas, load, toast]);

  // ── Selection ─────────────────────────────────────────────────────
  const toggleOne = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(
    (all: boolean) => {
      setSelected(all ? new Set(pageRows.map((r) => r._id)) : new Set());
    },
    [pageRows],
  );

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));

  // ── Export ─────────────────────────────────────────────────────────
  const buildExportRows = React.useCallback((): {
    headers: string[];
    rows: ExportRow[];
  } => {
    const source =
      selected.size > 0
        ? filteredVisas.filter((v) => selected.has(v._id))
        : filteredVisas;
    const headers = [
      'Employee',
      'Department',
      'Country',
      'Visa Number',
      'Issued',
      'Expiry',
      'Expiry Status',
      'File URL',
    ];
    const rows = source.map((v) => {
      const emp = employeeMap.get(String(v.user_id));
      const exp = expiryStatus(v.expiry_date);
      return {
        Employee: empName(v.user_id),
        Department: emp?.departmentName ?? '',
        Country: v.country,
        'Visa Number': v.visa_number ?? '',
        Issued: v.issue_date ? new Date(v.issue_date).toISOString().slice(0, 10) : '',
        Expiry: v.expiry_date ? new Date(v.expiry_date).toISOString().slice(0, 10) : '',
        'Expiry Status': exp,
        'File URL': v.file ?? '',
      } satisfies ExportRow;
    });
    return { headers, rows };
  }, [selected, filteredVisas, employeeMap, empName]);

  const exportCsv = React.useCallback(() => {
    const { headers, rows } = buildExportRows();
    downloadCsv(`visa-details-${dateStamp()}.csv`, headers, rows);
  }, [buildExportRows]);

  const exportXlsx = React.useCallback(() => {
    const { headers, rows } = buildExportRows();
    void downloadXlsx(`visa-details-${dateStamp()}.xlsx`, headers, rows, 'Visas');
  }, [buildExportRows]);

  const hasActiveFilters =
    !!search ||
    departmentFilter !== 'all' ||
    countryFilter !== 'all' ||
    statusFilter !== 'all' ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setSearchInput('');
    setDepartmentFilter('all');
    setCountryFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <EntityListShell
        title="Visa Details"
        subtitle="Track employee work visas and expiry dates."
        search={{
          value: searchInput,
          onChange: (v) => {
            setSearchInput(v);
            debouncedSearch(v);
          },
          placeholder: 'Search employee, country, visa #…',
        }}
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" /> CSV
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" onClick={exportXlsx}>
              <Download className="h-4 w-4" /> XLSX
            </ZoruButton>
            <ZoruButton onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Visa
            </ZoruButton>
          </div>
        }
        filters={
          <>
            <ZoruSelect
              value={departmentFilter}
              onValueChange={(v) => {
                setDepartmentFilter(v);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-48 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Department" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All departments</ZoruSelectItem>
                {departments.map((d) => (
                  <ZoruSelectItem key={d} value={d}>
                    {d}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={countryFilter}
              onValueChange={(v) => {
                setCountryFilter(v);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-44 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Country" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All countries</ZoruSelectItem>
                {countries.map((c) => (
                  <ZoruSelectItem key={c} value={c}>
                    {c}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as StatusFilter);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-44 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="valid">Valid</ZoruSelectItem>
                <ZoruSelectItem value="expiring-90d">Expiring &lt; 90 days</ZoruSelectItem>
                <ZoruSelectItem value="expired">Expired</ZoruSelectItem>
                <ZoruSelectItem value="no-expiry">No expiry</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
            <div className="flex items-center gap-1.5">
              <ZoruInput
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-[140px] rounded-full border-zoru-line bg-zoru-bg text-[12.5px]"
                aria-label="Issue date from"
              />
              <span className="text-[12px] text-zoru-ink-muted">to</span>
              <ZoruInput
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-[140px] rounded-full border-zoru-line bg-zoru-bg text-[12.5px]"
                aria-label="Issue date to"
              />
            </div>
            {hasActiveFilters ? (
              <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </ZoruButton>
            ) : null}
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-zoru-ink">
                {selected.size} visa{selected.size === 1 ? '' : 's'} selected
              </span>
              <div className="flex items-center gap-2">
                <ZoruButton variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-4 w-4" /> Export CSV
                </ZoruButton>
                <ZoruButton variant="outline" size="sm" onClick={exportXlsx}>
                  <Download className="h-4 w-4" /> Export XLSX
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkArchiveOpen(true)}
                >
                  <Archive className="h-4 w-4" /> Archive
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="text-zoru-danger-ink"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </ZoruButton>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Clear selection
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        pagination={
          total > 0 ? (
            <PaginationBar
              page={page}
              limit={ROWS_PER_PAGE}
              hasMore={page < totalPages}
              total={total}
              controlled={{ onChange: (next) => setPage(next.page) }}
            />
          ) : null
        }
        loading={isLoading && visas.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<Stamp className="h-4 w-4" />}
              label="Visa holders"
              value={kpis.totalHolders.toLocaleString('en-IN')}
              hint="Unique employees with a visa on file"
            />
            <KpiCard
              icon={<CalendarClock className="h-4 w-4" />}
              label="Expiring < 90 days"
              value={kpis.expiring90.toLocaleString('en-IN')}
              hint="Action required soon"
            />
            <KpiCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Expired"
              value={kpis.expired.toLocaleString('en-IN')}
              hint="Past expiry date"
            />
            <KpiCard
              icon={<Globe2 className="h-4 w-4" />}
              label="Top country"
              value={kpis.topCountry ? kpis.topCountry.name : '—'}
              hint={
                kpis.topCountry
                  ? `${kpis.topCountry.count.toLocaleString('en-IN')} of ${kpis.countryCount} countries`
                  : 'No data'
              }
            />
          </div>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[16px] text-zoru-ink">Visa Records</h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                One row per employee/country visa.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-zoru-line bg-zoru-surface-2">
                    <th className="w-10 px-3 py-2.5">
                      <ZoruCheckbox
                        checked={allOnPageSelected}
                        onCheckedChange={(c) => toggleAll(Boolean(c))}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Employee
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Country
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Visa #
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Issued
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Expires
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      File
                    </th>
                    <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center">
                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-10 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {hasActiveFilters
                          ? 'No visas match the current filters.'
                          : 'No visa records found.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((v) => {
                      const id = String(v._id);
                      const isSelected = selected.has(id);
                      const emp = employeeMap.get(String(v.user_id));
                      const empHref = `/dashboard/crm/hr-payroll/employees/${String(v.user_id)}`;
                      const exp = expiryStatus(v.expiry_date);
                      return (
                        <tr
                          key={id}
                          className="border-t border-zoru-line hover:bg-zoru-surface-2/50"
                        >
                          <td className="px-3 py-2.5">
                            <ZoruCheckbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(id)}
                              aria-label={`Select visa for ${empName(v.user_id)}`}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <EntityRowLink
                              href={empHref}
                              label={empName(v.user_id) || 'Unnamed'}
                              subtitle={emp?.departmentName ?? emp?.email ?? '—'}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-zoru-ink">{v.country}</td>
                          <td className="px-4 py-2.5 font-mono text-[12px] text-zoru-ink">
                            {v.visa_number || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-zoru-ink-muted">
                            {fmtDate(v.issue_date)}
                          </td>
                          <td className="px-4 py-2.5">
                            {v.expiry_date ? (
                              <ZoruBadge variant={expiryVariant(exp)}>
                                {fmtDate(v.expiry_date)}
                              </ZoruBadge>
                            ) : (
                              <span className="text-zoru-ink-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {v.file ? (
                              <a
                                href={v.file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[12.5px] text-sky-500 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" /> View
                              </a>
                            ) : (
                              <span className="text-zoru-ink-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(v)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </ZoruButton>
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTargetId(id)}
                                disabled={isSaving}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                              </ZoruButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </ZoruCard>
        </div>

        <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <ZoruDialogContent className="sm:max-w-[560px]">
            <ZoruDialogHeader>
              <ZoruDialogTitle>
                {form._id ? 'Edit Visa Details' : 'Add Visa Details'}
              </ZoruDialogTitle>
            </ZoruDialogHeader>
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <div className="md:col-span-2">
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                  Employee <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruSelect
                  value={form.user_id || '__none__'}
                  onValueChange={(v) => set('user_id', v === '__none__' ? '' : v)}
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue placeholder="Select employee" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="__none__">— Select employee —</ZoruSelectItem>
                    {employees.map((e) => (
                      <ZoruSelectItem key={e._id} value={e._id}>
                        {[e.firstName, e.lastName].filter(Boolean).join(' ') ||
                          e.email ||
                          'Unnamed'}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                  Country <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruInput
                  value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                  placeholder="e.g. United States"
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Visa Number</ZoruLabel>
                <ZoruInput
                  value={form.visa_number}
                  onChange={(e) => set('visa_number', e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Issue Date</ZoruLabel>
                <ZoruInput
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => set('issue_date', e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Expiry Date</ZoruLabel>
                <ZoruInput
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => set('expiry_date', e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="md:col-span-2">
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">File URL</ZoruLabel>
                <div className="mt-1.5 flex items-center gap-2">
                  <ZoruInput
                    type="url"
                    value={form.file}
                    onChange={(e) => set('file', e.target.value)}
                    placeholder="https://…"
                    className="h-10 flex-1 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                  />
                  <SabFilePickerButton
                    accept="document"
                    onPick={({ url }) => set('file', url)}
                  >
                    <Upload className="h-4 w-4" /> Choose file
                  </SabFilePickerButton>
                </div>
              </div>
            </div>
            <ZoruDialogFooter>
              <ZoruButton variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </ZoruButton>
              <ZoruButton onClick={handleSave} disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {form._id ? 'Update' : 'Add'}
              </ZoruButton>
            </ZoruDialogFooter>
          </ZoruDialogContent>
        </ZoruDialog>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this visa record?"
        description="This permanently removes the visa entry. The uploaded file in SabFiles is not deleted."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} visa${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected visa records."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />

      <ConfirmDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        title={`Archive ${selected.size} visa${selected.size === 1 ? '' : 's'}?`}
        description="Sets expiry to today and tags the country as [archived]."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={handleBulkArchive}
      />
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <ZoruCard className="p-5">
      <div className="flex items-center gap-2 text-zoru-ink-muted">
        {icon}
        <p className="text-[12.5px] font-medium">{label}</p>
      </div>
      <div className="mt-2 truncate text-2xl text-zoru-ink">{value}</div>
      {hint ? (
        <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{hint}</p>
      ) : null}
    </ZoruCard>
  );
}
