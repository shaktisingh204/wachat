'use client';

/**
 * Emergency Contacts — deepened list per Deep template (ref
 * src/app/dashboard/crm/hr-payroll/employees/teams/page.tsx).
 *
 * Composition:
 *   <EntityListShell>
 *     - KPI strip (total employees, coverage %, missing count, with phone)
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
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  Archive,
  Download,
  LifeBuoy,
  LoaderCircle,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  deleteEmergencyContact,
  getEmergencyContacts,
  saveEmergencyContact,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsEmergencyContact } from '@/lib/worksuite/hr-ext-types';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

type ContactRow = WsEmergencyContact & { _id: string };
type EmployeeLite = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  departmentName?: string;
  status?: string;
};
type StatusFilter = 'all' | 'valid' | 'missing-phone' | 'missing-address';

type FormState = {
  _id: string;
  user_id: string;
  name: string;
  relation: string;
  phone: string;
  address: string;
};

const EMPTY_FORM: FormState = {
  _id: '',
  user_id: '',
  name: '',
  relation: '',
  phone: '',
  address: '',
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

function isValidPhone(phone?: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.length >= 7;
}

export default function EmergencyContactsPage() {
  const { toast } = useZoruToast();

  const [contacts, setContacts] = React.useState<ContactRow[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeLite[]>([]);

  const [isLoading, startLoad] = React.useTransition();
  const [isSaving, startSave] = React.useTransition();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);

  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
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
      const [cs, es] = await Promise.all([getEmergencyContacts(), getCrmEmployees()]);
      setContacts(cs as ContactRow[]);
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
    for (const e of employees) {
      if (e.departmentName) set.add(e.departmentName);
    }
    return Array.from(set).sort();
  }, [employees]);

  const filteredContacts = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86_400_000 - 1 : null;
    return contacts.filter((c) => {
      const emp = employeeMap.get(String(c.user_id));
      if (q) {
        const haystack = [c.name, c.relation, c.phone, empName(c.user_id), emp?.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (departmentFilter !== 'all' && emp?.departmentName !== departmentFilter) return false;
      const phoneOk = isValidPhone(c.phone);
      switch (statusFilter) {
        case 'valid':
          if (!phoneOk) return false;
          break;
        case 'missing-phone':
          if (phoneOk) return false;
          break;
        case 'missing-address':
          if (c.address && c.address.trim().length > 0) return false;
          break;
      }
      const created = toDate((c as any).createdAt);
      if (created) {
        if (fromTs && created.getTime() < fromTs) return false;
        if (toTs && created.getTime() > toTs) return false;
      } else if (fromTs || toTs) {
        return false;
      }
      return true;
    });
  }, [
    contacts,
    search,
    departmentFilter,
    statusFilter,
    dateFrom,
    dateTo,
    employeeMap,
    empName,
  ]);

  const total = filteredContacts.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const pageRows = React.useMemo(
    () => filteredContacts.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [filteredContacts, page],
  );

  // KPIs over all employees (coverage is org-wide, not filter-scoped).
  const kpis = React.useMemo(() => {
    const totalEmployees = employees.length;
    const validContactUserIds = new Set<string>();
    let withPhone = 0;
    for (const c of contacts) {
      if (isValidPhone(c.phone)) validContactUserIds.add(String(c.user_id));
      if (isValidPhone(c.phone)) withPhone += 1;
    }
    const covered = validContactUserIds.size;
    const coverage =
      totalEmployees > 0 ? Math.round((covered / totalEmployees) * 1000) / 10 : 0;
    const missing = totalEmployees - covered;
    return { totalEmployees, coverage, missing, withPhone };
  }, [contacts, employees]);

  // ── Form helpers ───────────────────────────────────────────────────
  const openAdd = React.useCallback(() => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((c: ContactRow) => {
    setForm({
      _id: String(c._id),
      user_id: String(c.user_id),
      name: c.name,
      relation: c.relation ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
    });
    setDialogOpen(true);
  }, []);

  const handleSave = React.useCallback(() => {
    if (!form.user_id) {
      toast({ title: 'Select an employee', variant: 'destructive' });
      return;
    }
    if (!form.name.trim()) {
      toast({ title: 'Contact name is required', variant: 'destructive' });
      return;
    }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('user_id', form.user_id);
      fd.append('name', form.name);
      fd.append('relation', form.relation);
      fd.append('phone', form.phone);
      fd.append('address', form.address);
      const res = await saveEmergencyContact(null, fd);
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
      const res = await deleteEmergencyContact(id);
      if ((res as any)?.error) {
        toast({
          title: 'Delete failed',
          description: (res as any).error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Contact deleted' });
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
      const res = await deleteEmergencyContact(id);
      if (!(res as any)?.error) ok += 1;
    }
    toast({ title: `${ok} contact${ok === 1 ? '' : 's'} deleted` });
    setBulkDeleteOpen(false);
    setSelected(new Set());
    load();
  }, [selected, load, toast]);

  // Archive = prefix name with [archived] so it stays filterable.
  const handleBulkArchive = React.useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let ok = 0;
    for (const id of ids) {
      const c = contacts.find((x) => String(x._id) === id);
      if (!c) continue;
      const fd = new FormData();
      fd.append('_id', id);
      fd.append('user_id', String(c.user_id));
      fd.append(
        'name',
        c.name.toLowerCase().startsWith('[archived]') ? c.name : `[archived] ${c.name}`,
      );
      fd.append('relation', c.relation ?? '');
      fd.append('phone', c.phone ?? '');
      fd.append('address', c.address ?? '');
      const res = await saveEmergencyContact(null, fd);
      if (!res?.error) ok += 1;
    }
    toast({ title: `${ok} contact${ok === 1 ? '' : 's'} archived` });
    setBulkArchiveOpen(false);
    setSelected(new Set());
    load();
  }, [selected, contacts, load, toast]);

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
        ? filteredContacts.filter((c) => selected.has(c._id))
        : filteredContacts;
    const headers = [
      'Employee',
      'Department',
      'Contact Name',
      'Relation',
      'Phone',
      'Address',
      'Valid Phone',
    ];
    const rows = source.map((c) => {
      const emp = employeeMap.get(String(c.user_id));
      return {
        Employee: empName(c.user_id),
        Department: emp?.departmentName ?? '',
        'Contact Name': c.name,
        Relation: c.relation ?? '',
        Phone: c.phone ?? '',
        Address: c.address ?? '',
        'Valid Phone': isValidPhone(c.phone) ? 'Yes' : 'No',
      } satisfies ExportRow;
    });
    return { headers, rows };
  }, [selected, filteredContacts, employeeMap, empName]);

  const exportCsv = React.useCallback(() => {
    const { headers, rows } = buildExportRows();
    downloadCsv(`emergency-contacts-${dateStamp()}.csv`, headers, rows);
  }, [buildExportRows]);

  const exportXlsx = React.useCallback(() => {
    const { headers, rows } = buildExportRows();
    void downloadXlsx(
      `emergency-contacts-${dateStamp()}.xlsx`,
      headers,
      rows,
      'Emergency Contacts',
    );
  }, [buildExportRows]);

  const hasActiveFilters =
    !!search ||
    departmentFilter !== 'all' ||
    statusFilter !== 'all' ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setSearchInput('');
    setDepartmentFilter('all');
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
        title="Emergency Contacts"
        subtitle="Emergency contact details for each employee."
        search={{
          value: searchInput,
          onChange: (v) => {
            setSearchInput(v);
            debouncedSearch(v);
          },
          placeholder: 'Search employee or contact…',
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
              <Plus className="h-4 w-4" /> Add Contact
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
                <ZoruSelectItem value="valid">Valid phone</ZoruSelectItem>
                <ZoruSelectItem value="missing-phone">Missing phone</ZoruSelectItem>
                <ZoruSelectItem value="missing-address">Missing address</ZoruSelectItem>
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
                aria-label="Created from"
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
                aria-label="Created to"
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
                {selected.size} contact{selected.size === 1 ? '' : 's'} selected
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
        loading={isLoading && contacts.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<LifeBuoy className="h-4 w-4" />}
              label="Total employees"
              value={kpis.totalEmployees.toLocaleString('en-IN')}
              hint="Org-wide headcount"
            />
            <KpiCard
              icon={<UserCheck className="h-4 w-4" />}
              label="Coverage"
              value={`${kpis.coverage.toFixed(1)}%`}
              hint="With ≥ 1 valid emergency contact"
            />
            <KpiCard
              icon={<UserX className="h-4 w-4" />}
              label="Missing"
              value={kpis.missing.toLocaleString('en-IN')}
              hint="No valid contact on file"
            />
            <KpiCard
              icon={<Phone className="h-4 w-4" />}
              label="With phone"
              value={kpis.withPhone.toLocaleString('en-IN')}
              hint="Contacts with usable phone"
            />
          </div>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[16px] text-zoru-ink">Contacts</h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                Emergency contacts grouped by employee.
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
                      Contact
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Relation
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Phone
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Address
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
                          ? 'No contacts match the current filters.'
                          : 'No emergency contacts found.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((c) => {
                      const id = String(c._id);
                      const isSelected = selected.has(id);
                      const emp = employeeMap.get(String(c.user_id));
                      const empHref = `/dashboard/crm/hr-payroll/employees/${String(c.user_id)}`;
                      const phoneOk = isValidPhone(c.phone);
                      return (
                        <tr
                          key={id}
                          className="border-t border-zoru-line hover:bg-zoru-surface-2/50"
                        >
                          <td className="px-3 py-2.5">
                            <ZoruCheckbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(id)}
                              aria-label={`Select ${c.name}`}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <EntityRowLink
                              href={empHref}
                              label={empName(c.user_id) || 'Unnamed'}
                              subtitle={emp?.departmentName ?? emp?.email ?? '—'}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-zoru-ink">{c.name}</td>
                          <td className="px-4 py-2.5 text-zoru-ink-muted">
                            {c.relation || '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            {c.phone ? (
                              <ZoruBadge variant={phoneOk ? 'success' : 'warning'}>
                                {c.phone}
                              </ZoruBadge>
                            ) : (
                              <span className="text-zoru-ink-muted">—</span>
                            )}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-2.5 text-zoru-ink-muted">
                            {c.address || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(c)}
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
          <ZoruDialogContent className="sm:max-w-[520px]">
            <ZoruDialogHeader>
              <ZoruDialogTitle>
                {form._id ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
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
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                    Contact Name <span className="text-zoru-danger-ink">*</span>
                  </ZoruLabel>
                  <ZoruInput
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                  />
                </div>
                <div>
                  <ZoruLabel className="text-[12px] text-zoru-ink-muted">Relation</ZoruLabel>
                  <ZoruInput
                    value={form.relation}
                    onChange={(e) => set('relation', e.target.value)}
                    placeholder="e.g. Spouse, Parent"
                    className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                  />
                </div>
                <div className="md:col-span-2">
                  <ZoruLabel className="text-[12px] text-zoru-ink-muted">Phone</ZoruLabel>
                  <ZoruInput
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                  />
                </div>
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Address</ZoruLabel>
                <ZoruTextarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  className="mt-1.5 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
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
        title="Delete this emergency contact?"
        description="This permanently removes the contact."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} contact${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected contacts."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />

      <ConfirmDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        title={`Archive ${selected.size} contact${selected.size === 1 ? '' : 's'}?`}
        description="Tags the contact name as [archived] so it can be filtered out."
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
