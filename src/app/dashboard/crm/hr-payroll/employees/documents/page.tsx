'use client';

/**
 * Employee Documents — deepened list per Deep template (ref
 * src/app/dashboard/crm/hr-payroll/employees/teams/page.tsx).
 *
 * Composition:
 *   <EntityListShell>
 *     - KPI strip (total docs, by type, expiring soon, missing critical)
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
  Download,
  ExternalLink,
  FileText,
  FileWarning,
  Files,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  deleteEmployeeDocument,
  getEmployeeDocuments,
  saveEmployeeDocument,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsEmployeeDocument } from '@/lib/worksuite/hr-ext-types';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

type DocRow = WsEmployeeDocument & { _id: string };
type EmployeeLite = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  departmentName?: string;
  status?: string;
};
type StatusFilter = 'all' | 'expired' | 'expiring-30d' | 'expiring-90d' | 'no-expiry';
type DocTypeFilter = 'all' | 'id' | 'address' | 'education' | 'other';

type FormState = {
  _id: string;
  user_id: string;
  name: string;
  file: string;
  uploaded_at: string;
  expiry_date: string;
};

const EMPTY_FORM: FormState = {
  _id: '',
  user_id: '',
  name: '',
  file: '',
  uploaded_at: '',
  expiry_date: '',
};
const ROWS_PER_PAGE = 20;

const CRITICAL_DOC_TYPES = ['id', 'address', 'education'] as const;

function toDate(v: any): Date | null {
  if (!v) return null;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function classifyDocType(name: string): DocTypeFilter {
  const n = name.toLowerCase();
  if (/passport|aadhaar|aadhar|pan\b|id\b|licence|license|driving|nation/.test(n)) return 'id';
  if (/address|utility|rent|electric|water|gas|lease/.test(n)) return 'address';
  if (/degree|diploma|certif|transcript|education|school|college|univers/.test(n)) return 'education';
  return 'other';
}

function expiryStatus(
  expiry?: Date | string,
): 'expired' | 'soon-30' | 'soon-90' | 'ok' | 'none' {
  const d = toDate(expiry);
  if (!d) return 'none';
  const diff = (d.getTime() - Date.now()) / 86_400_000;
  if (diff < 0) return 'expired';
  if (diff < 30) return 'soon-30';
  if (diff < 90) return 'soon-90';
  return 'ok';
}

function expiryVariant(status: ReturnType<typeof expiryStatus>): 'danger' | 'warning' | 'success' | 'secondary' {
  if (status === 'expired') return 'danger';
  if (status === 'soon-30') return 'danger';
  if (status === 'soon-90') return 'warning';
  if (status === 'ok') return 'success';
  return 'secondary';
}

function expiryLabel(date: Date | null, status: ReturnType<typeof expiryStatus>): string {
  if (!date) return '—';
  const fmt = date.toLocaleDateString();
  if (status === 'expired') return `${fmt} (Expired)`;
  if (status === 'soon-30') return `${fmt} (<30d)`;
  if (status === 'soon-90') return `${fmt} (<90d)`;
  return fmt;
}

export default function EmployeeDocumentsPage() {
  const { toast } = useZoruToast();

  const [docs, setDocs] = React.useState<DocRow[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeLite[]>([]);

  const [isLoading, startLoad] = React.useTransition();
  const [isSaving, startSave] = React.useTransition();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);

  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = React.useState<DocTypeFilter>('all');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');
  const [page, setPage] = React.useState(1);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = React.useState(false);

  const load = React.useCallback(() => {
    startLoad(async () => {
      const [d, e] = await Promise.all([getEmployeeDocuments(), getCrmEmployees()]);
      setDocs(d as DocRow[]);
      setEmployees(
        (e as any[]).map((x) => ({
          _id: String(x._id),
          firstName: x.firstName,
          lastName: x.lastName,
          email: x.email,
          departmentName: x.departmentName,
          status: x.status,
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
    for (const e of employees) {
      if (e.departmentName) set.add(e.departmentName);
    }
    return Array.from(set).sort();
  }, [employees]);

  const filteredDocs = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86_400_000 - 1 : null;
    return docs.filter((d) => {
      const emp = employeeMap.get(String(d.user_id));
      if (q) {
        const haystack = [d.name, empName(d.user_id), emp?.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (departmentFilter !== 'all' && emp?.departmentName !== departmentFilter) return false;
      if (typeFilter !== 'all' && classifyDocType(d.name) !== typeFilter) return false;
      const exp = expiryStatus(d.expiry_date);
      switch (statusFilter) {
        case 'expired':
          if (exp !== 'expired') return false;
          break;
        case 'expiring-30d':
          if (exp !== 'soon-30') return false;
          break;
        case 'expiring-90d':
          if (exp !== 'soon-30' && exp !== 'soon-90') return false;
          break;
        case 'no-expiry':
          if (exp !== 'none') return false;
          break;
      }
      const uploaded = toDate(d.uploaded_at);
      if (uploaded) {
        if (fromTs && uploaded.getTime() < fromTs) return false;
        if (toTs && uploaded.getTime() > toTs) return false;
      } else if (fromTs || toTs) {
        return false;
      }
      return true;
    });
  }, [
    docs,
    search,
    departmentFilter,
    statusFilter,
    typeFilter,
    dateFrom,
    dateTo,
    employeeMap,
    empName,
  ]);

  const total = filteredDocs.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const pageRows = React.useMemo(
    () => filteredDocs.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [filteredDocs, page],
  );

  // KPIs (over filtered set).
  const kpis = React.useMemo(() => {
    const totalDocs = filteredDocs.length;
    const byType = { id: 0, address: 0, education: 0, other: 0 };
    let expiringSoon = 0;
    const employeesWithType: Record<(typeof CRITICAL_DOC_TYPES)[number], Set<string>> = {
      id: new Set(),
      address: new Set(),
      education: new Set(),
    };
    for (const d of filteredDocs) {
      const t = classifyDocType(d.name);
      byType[t] += 1;
      if (t !== 'other') employeesWithType[t].add(String(d.user_id));
      const exp = expiryStatus(d.expiry_date);
      if (exp === 'soon-30' || exp === 'soon-90' || exp === 'expired') expiringSoon += 1;
    }
    // "missing critical" = employees with no doc in one of the 3 critical types.
    const allEmpIds = new Set(employees.map((e) => e._id));
    let missingCritical = 0;
    for (const eid of allEmpIds) {
      for (const t of CRITICAL_DOC_TYPES) {
        if (!employeesWithType[t].has(eid)) {
          missingCritical += 1;
          break;
        }
      }
    }
    return { totalDocs, byType, expiringSoon, missingCritical };
  }, [filteredDocs, employees]);

  // ── Form helpers ───────────────────────────────────────────────────
  const openAdd = React.useCallback(() => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((d: DocRow) => {
    setForm({
      _id: String(d._id),
      user_id: String(d.user_id),
      name: d.name,
      file: d.file ?? '',
      uploaded_at: d.uploaded_at ? new Date(d.uploaded_at).toISOString().slice(0, 10) : '',
      expiry_date: d.expiry_date ? new Date(d.expiry_date).toISOString().slice(0, 10) : '',
    });
    setDialogOpen(true);
  }, []);

  const handleSave = React.useCallback(() => {
    if (!form.user_id) {
      toast({ title: 'Select an employee', variant: 'destructive' });
      return;
    }
    if (!form.name.trim()) {
      toast({ title: 'Document name is required', variant: 'destructive' });
      return;
    }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('user_id', form.user_id);
      fd.append('name', form.name);
      if (form.file) fd.append('file', form.file);
      if (form.uploaded_at) fd.append('uploaded_at', form.uploaded_at);
      if (form.expiry_date) fd.append('expiry_date', form.expiry_date);
      const res = await saveEmployeeDocument(null, fd);
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
      const res = await deleteEmployeeDocument(id);
      if ((res as any)?.error) {
        toast({
          title: 'Delete failed',
          description: (res as any).error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Document deleted' });
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
      const res = await deleteEmployeeDocument(id);
      if (!(res as any)?.error) ok += 1;
    }
    toast({ title: `${ok} document${ok === 1 ? '' : 's'} deleted` });
    setBulkDeleteOpen(false);
    setSelected(new Set());
    load();
  }, [selected, load, toast]);

  // Archive = expire the document by setting expiry_date to today, plus a
  // `[archived]` name prefix so it stays visible but filterable.
  const handleBulkArchive = React.useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let ok = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const id of ids) {
      const doc = docs.find((d) => String(d._id) === id);
      if (!doc) continue;
      const fd = new FormData();
      fd.append('_id', id);
      fd.append('user_id', String(doc.user_id));
      fd.append(
        'name',
        doc.name.toLowerCase().startsWith('[archived]') ? doc.name : `[archived] ${doc.name}`,
      );
      if (doc.file) fd.append('file', doc.file);
      if (doc.uploaded_at) {
        fd.append('uploaded_at', new Date(doc.uploaded_at).toISOString().slice(0, 10));
      }
      fd.append('expiry_date', today);
      const res = await saveEmployeeDocument(null, fd);
      if (!res?.error) ok += 1;
    }
    toast({ title: `${ok} document${ok === 1 ? '' : 's'} archived` });
    setBulkArchiveOpen(false);
    setSelected(new Set());
    load();
  }, [selected, docs, load, toast]);

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
        ? filteredDocs.filter((d) => selected.has(d._id))
        : filteredDocs;
    const headers = [
      'Employee',
      'Department',
      'Document',
      'Type',
      'Uploaded',
      'Expiry',
      'Expiry Status',
      'File URL',
    ];
    const rows = source.map((d) => {
      const emp = employeeMap.get(String(d.user_id));
      const exp = expiryStatus(d.expiry_date);
      return {
        Employee: empName(d.user_id),
        Department: emp?.departmentName ?? '',
        Document: d.name,
        Type: classifyDocType(d.name),
        Uploaded: d.uploaded_at ? new Date(d.uploaded_at).toISOString().slice(0, 10) : '',
        Expiry: d.expiry_date ? new Date(d.expiry_date).toISOString().slice(0, 10) : '',
        'Expiry Status': exp,
        'File URL': d.file ?? '',
      } satisfies ExportRow;
    });
    return { headers, rows };
  }, [selected, filteredDocs, employeeMap, empName]);

  const exportCsv = React.useCallback(() => {
    const { headers, rows } = buildExportRows();
    downloadCsv(`employee-documents-${dateStamp()}.csv`, headers, rows);
  }, [buildExportRows]);

  const exportXlsx = React.useCallback(() => {
    const { headers, rows } = buildExportRows();
    void downloadXlsx(
      `employee-documents-${dateStamp()}.xlsx`,
      headers,
      rows,
      'Documents',
    );
  }, [buildExportRows]);

  const hasActiveFilters =
    !!search ||
    departmentFilter !== 'all' ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setSearchInput('');
    setDepartmentFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <EntityListShell
        title="Employee Documents"
        subtitle="Upload and track employee documents with expiry dates."
        search={{
          value: searchInput,
          onChange: (v) => {
            setSearchInput(v);
            debouncedSearch(v);
          },
          placeholder: 'Search employee or document…',
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
              <Plus className="h-4 w-4" /> Add Document
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
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as DocTypeFilter);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-40 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Type" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All types</ZoruSelectItem>
                <ZoruSelectItem value="id">ID</ZoruSelectItem>
                <ZoruSelectItem value="address">Address</ZoruSelectItem>
                <ZoruSelectItem value="education">Education</ZoruSelectItem>
                <ZoruSelectItem value="other">Other</ZoruSelectItem>
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
                <ZoruSelectValue placeholder="Expiry" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="expired">Expired</ZoruSelectItem>
                <ZoruSelectItem value="expiring-30d">Expiring &lt; 30 days</ZoruSelectItem>
                <ZoruSelectItem value="expiring-90d">Expiring &lt; 90 days</ZoruSelectItem>
                <ZoruSelectItem value="no-expiry">No expiry set</ZoruSelectItem>
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
                aria-label="Uploaded from"
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
                aria-label="Uploaded to"
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
                {selected.size} document{selected.size === 1 ? '' : 's'} selected
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
        loading={isLoading && docs.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<Files className="h-4 w-4" />}
              label="Total documents"
              value={kpis.totalDocs.toLocaleString('en-IN')}
              hint="Visible after filters"
            />
            <KpiCard
              icon={<FileText className="h-4 w-4" />}
              label="By type"
              value={`${kpis.byType.id}/${kpis.byType.address}/${kpis.byType.education}`}
              hint="ID / Address / Education"
            />
            <KpiCard
              icon={<FileWarning className="h-4 w-4" />}
              label="Expiring soon"
              value={kpis.expiringSoon.toLocaleString('en-IN')}
              hint="Expired or expiring < 90 days"
            />
            <KpiCard
              icon={<FileWarning className="h-4 w-4" />}
              label="Missing critical"
              value={kpis.missingCritical.toLocaleString('en-IN')}
              hint="Employees missing ID, address or education"
            />
          </div>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[16px] text-zoru-ink">Documents</h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                One row per uploaded document.
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
                      Document
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Uploaded
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Expiry
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
                      <td colSpan={7} className="py-10 text-center">
                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {hasActiveFilters
                          ? 'No documents match the current filters.'
                          : 'No documents found.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((d) => {
                      const id = String(d._id);
                      const isSelected = selected.has(id);
                      const emp = employeeMap.get(String(d.user_id));
                      const empHref = `/dashboard/crm/hr-payroll/employees/${String(d.user_id)}`;
                      const exp = expiryStatus(d.expiry_date);
                      const expDate = toDate(d.expiry_date);
                      const docType = classifyDocType(d.name);
                      return (
                        <tr
                          key={id}
                          className="border-t border-zoru-line hover:bg-zoru-surface-2/50"
                        >
                          <td className="px-3 py-2.5">
                            <ZoruCheckbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(id)}
                              aria-label={`Select ${d.name}`}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <EntityRowLink
                              href={empHref}
                              label={empName(d.user_id) || 'Unnamed'}
                              subtitle={emp?.departmentName ?? emp?.email ?? '—'}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-zoru-ink">
                            <div className="flex flex-col">
                              <span>{d.name}</span>
                              <span className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                                {docType}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-zoru-ink-muted">
                            {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            {expDate ? (
                              <ZoruBadge variant={expiryVariant(exp)}>
                                {expiryLabel(expDate, exp)}
                              </ZoruBadge>
                            ) : (
                              <span className="text-zoru-ink-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {d.file ? (
                              <a
                                href={d.file}
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
                                onClick={() => openEdit(d)}
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
          <ZoruDialogContent className="sm:max-w-[480px]">
            <ZoruDialogHeader>
              <ZoruDialogTitle>
                {form._id ? 'Edit Document' : 'Add Document'}
              </ZoruDialogTitle>
            </ZoruDialogHeader>
            <div className="grid gap-4 py-2">
              <div>
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
                  Document Name <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruInput
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Passport, ID Card"
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">File URL</ZoruLabel>
                <div className="mt-1.5 flex items-center gap-2">
                  <ZoruInput
                    type="url"
                    value={form.file}
                    onChange={(e) => set('file', e.target.value)}
                    placeholder="https://…"
                    className="h-10 flex-1 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                  />
                  <SabFilePickerButton accept="all" onPick={({ url }) => set('file', url)}>
                    <Upload className="h-4 w-4" /> Choose file
                  </SabFilePickerButton>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <ZoruLabel className="text-[12px] text-zoru-ink-muted">Uploaded</ZoruLabel>
                  <ZoruInput
                    type="date"
                    value={form.uploaded_at}
                    onChange={(e) => set('uploaded_at', e.target.value)}
                    className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                  />
                </div>
                <div>
                  <ZoruLabel className="text-[12px] text-zoru-ink-muted">Expiry</ZoruLabel>
                  <ZoruInput
                    type="date"
                    value={form.expiry_date}
                    onChange={(e) => set('expiry_date', e.target.value)}
                    className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                  />
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
        title="Delete this document?"
        description="This permanently removes the document. The file in SabFiles is not deleted."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} document${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected documents."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />

      <ConfirmDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        title={`Archive ${selected.size} document${selected.size === 1 ? '' : 's'}?`}
        description="Sets expiry to today and tags the name as [archived]. Files are kept."
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
