'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  AlertCircle,
  Banknote,
  CalendarClock,
  Download,
  LoaderCircle,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
  deleteTdsRecord,
  getTdsRecords,
  type CrmTdsQuarter,
  type CrmTdsStatus,
} from '@/app/actions/crm-tds.actions';
import { getCrmDepartments } from '@/app/actions/crm-employees.actions';
import { getSession } from '@/app/actions/user.actions';

const PAGE_SIZE = 10;
const currentYear = new Date().getFullYear();

function getFinancialYears(count = 5) {
  const years: string[] = [];
  for (let i = 0; i < count; i++) {
    const start = currentYear - i - 1;
    const end = currentYear - i;
    years.push(`${start}-${String(end).slice(-2)}`);
  }
  return years;
}

function statusBadge(status: string) {
  if (status === 'filed')
    return <ZoruBadge variant="success">Filed</ZoruBadge>;
  if (status === 'deposited')
    return <ZoruBadge variant="info">Deposited</ZoruBadge>;
  if (status === 'pending')
    return <ZoruBadge variant="warning">Pending</ZoruBadge>;
  if (status === 'archived')
    return <ZoruBadge variant="secondary">Archived</ZoruBadge>;
  return <ZoruBadge variant="secondary">{status}</ZoruBadge>;
}

type StatusFilter = CrmTdsStatus | 'all';
type QuarterFilter = CrmTdsQuarter | 'all';

type TdsRow = {
  _id?: unknown;
  employeeId?: string;
  employeeName?: string;
  designation?: string;
  financialYear?: string;
  quarter?: CrmTdsQuarter;
  pan?: string;
  taxRegime?: 'old' | 'new';
  grossAmount?: number;
  tdsAmount?: number;
  certificateNumber?: string;
  depositChallanNumber?: string;
  depositedOn?: string | Date;
  filedOn?: string | Date;
  status?: string;
  departmentId?: string;
};

export default function TdsPage() {
  const { toast } = useZoruToast();
  const financialYears = useMemo(() => getFinancialYears(5), []);
  const currentFy = financialYears[0];

  const [rows, setRows] = useState<TdsRow[]>([]);
  const [departments, setDepartments] = useState<
    Array<{ _id: unknown; name: string }>
  >([]);
  const [authed, setAuthed] = useState(false);
  const [isLoading, startTransition] = useTransition();

  // filters
  const [search, setSearch] = useState('');
  const [fyFilter, setFyFilter] = useState<string>(currentFy);
  const [quarterFilter, setQuarterFilter] = useState<QuarterFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');

  // pagination + selection
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSession().then((s) => {
      if (cancelled) return;
      setAuthed(!!s?.user);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(() => {
    startTransition(async () => {
      const [res, depts] = await Promise.all([
        getTdsRecords({
          q: search || undefined,
          status: statusFilter,
          financialYear: fyFilter || undefined,
          quarter: quarterFilter === 'all' ? undefined : quarterFilter,
          limit: 500,
        }),
        getCrmDepartments().catch(
          () => [] as Array<{ _id: unknown; name: string }>,
        ),
      ]);
      setRows((res.items ?? []) as TdsRow[]);
      setDepartments(depts as Array<{ _id: unknown; name: string }>);
    });
  }, [search, statusFilter, fyFilter, quarterFilter]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  // KPIs
  const kpis = useMemo(() => {
    const totalDeducted = rows.reduce(
      (s, r) => s + Number(r.tdsAmount ?? 0),
      0,
    );
    const pendingChallans = rows.filter((r) => r.status === 'pending').length;
    let lastFiling: Date | null = null;
    for (const r of rows) {
      const f = r.filedOn ? new Date(r.filedOn) : null;
      if (f && (!lastFiling || f.getTime() > lastFiling.getTime())) {
        lastFiling = f;
      }
    }
    // top employee by TDS amount
    const byEmp = new Map<
      string,
      { name: string; total: number }
    >();
    for (const r of rows) {
      const key = String(r.employeeId ?? r.employeeName ?? '');
      if (!key) continue;
      const cur = byEmp.get(key) ?? {
        name: r.employeeName ?? '—',
        total: 0,
      };
      cur.total += Number(r.tdsAmount ?? 0);
      byEmp.set(key, cur);
    }
    let topEmployee: { name: string; total: number } | null = null;
    for (const v of byEmp.values()) {
      if (!topEmployee || v.total > topEmployee.total) topEmployee = v;
    }
    return {
      totalDeducted,
      pendingChallans,
      lastFiling,
      topEmployee,
    };
  }, [rows]);

  // department filter applied client-side
  const filtered = useMemo(() => {
    if (!departmentFilter) return rows;
    return rows.filter(
      (r) => String(r.departmentId ?? '') === departmentFilter,
    );
  }, [rows, departmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const hasActiveFilters =
    !!search ||
    statusFilter !== 'all' ||
    quarterFilter !== 'all' ||
    fyFilter !== currentFy ||
    !!departmentFilter;

  const clearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setQuarterFilter('all');
    setFyFilter(currentFy);
    setDepartmentFilter('');
    setPage(1);
  }, [currentFy]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTargetId) return;
    const res = await deleteTdsRecord(deleteTargetId);
    if (res?.success) {
      toast({ title: 'TDS record archived' });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteTargetId);
        return next;
      });
      load();
    } else {
      toast({
        title: 'Delete failed',
        description: res?.error,
        variant: 'destructive',
      });
    }
    setDeleteTargetId(null);
  }, [deleteTargetId, load, toast]);

  const runBulkDelete = useCallback(async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    let ok = 0;
    for (const id of ids) {
      const res = await deleteTdsRecord(id);
      if (res?.success) ok += 1;
    }
    toast({ title: `${ok} record${ok === 1 ? '' : 's'} archived` });
    setSelected(new Set());
    setBulkDeleteOpen(false);
    load();
  }, [selected, load, toast]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (all: boolean) => {
      setSelected(
        all
          ? new Set(paged.map((r) => String(r._id)).filter(Boolean) as string[])
          : new Set(),
      );
    },
    [paged],
  );

  const allSelected =
    paged.length > 0 && paged.every((r) => selected.has(String(r._id)));

  const exportRows = useCallback(
    (kind: 'csv' | 'xlsx') => {
      const ids = selected.size > 0 ? selected : null;
      const out = ids
        ? filtered.filter((r) => ids.has(String(r._id)))
        : filtered;
      const header = [
        'Employee',
        'PAN',
        'FY',
        'Quarter',
        'GrossAmount',
        'TdsAmount',
        'CertificateNumber',
        'ChallanNumber',
        'DepositedOn',
        'FiledOn',
        'Status',
      ];
      const escape = (v: unknown) =>
        `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [
        header.join(','),
        ...out.map((r) =>
          [
            escape(r.employeeName ?? ''),
            escape(r.pan ?? ''),
            escape(r.financialYear ?? ''),
            escape(r.quarter ?? ''),
            escape(r.grossAmount ?? 0),
            escape(r.tdsAmount ?? 0),
            escape(r.certificateNumber ?? ''),
            escape(r.depositChallanNumber ?? ''),
            escape(r.depositedOn ? new Date(r.depositedOn).toISOString() : ''),
            escape(r.filedOn ? new Date(r.filedOn).toISOString() : ''),
            escape(r.status ?? ''),
          ].join(','),
        ),
      ].join('\n');
      const mime =
        kind === 'xlsx'
          ? 'application/vnd.ms-excel;charset=utf-8;'
          : 'text/csv;charset=utf-8;';
      const ext = kind === 'xlsx' ? 'xls' : 'csv';
      const blob = new Blob([csv], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tds-${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [filtered, selected],
  );

  return (
    <>
      <EntityListShell
        title="TDS Management"
        subtitle="Track quarterly TDS deductions, deposits, and filings."
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
          placeholder: 'Search employee, certificate, challan…',
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
              value={fyFilter || 'all'}
              onValueChange={(v) => {
                setFyFilter(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-32 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="FY" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All FYs</ZoruSelectItem>
                {financialYears.map((fy) => (
                  <ZoruSelectItem key={fy} value={fy}>
                    FY {fy}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={quarterFilter}
              onValueChange={(v) => {
                setQuarterFilter(v as QuarterFilter);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-28 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Quarter" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All Qs</ZoruSelectItem>
                <ZoruSelectItem value="Q1">Q1</ZoruSelectItem>
                <ZoruSelectItem value="Q2">Q2</ZoruSelectItem>
                <ZoruSelectItem value="Q3">Q3</ZoruSelectItem>
                <ZoruSelectItem value="Q4">Q4</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as StatusFilter);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-36 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
                <ZoruSelectItem value="deposited">Deposited</ZoruSelectItem>
                <ZoruSelectItem value="filed">Filed</ZoruSelectItem>
                <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={departmentFilter || 'all'}
              onValueChange={(v) => {
                setDepartmentFilter(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-44 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Department" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All departments</ZoruSelectItem>
                {departments.map((d) => (
                  <ZoruSelectItem key={String(d._id)} value={String(d._id)}>
                    {d.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => exportRows('csv')}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => exportRows('xlsx')}
            >
              <Download className="h-3.5 w-3.5" />
              Export XLSX
            </ZoruButton>
            {hasActiveFilters && (
              <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" />
                Clear
              </ZoruButton>
            )}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zoru-line bg-zoru-surface-2 px-4 py-2.5">
              <div className="text-[13px] text-zoru-ink">
                {selected.size} selected
              </div>
              <div className="flex items-center gap-2">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => exportRows('csv')}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export selected
                </ZoruButton>
                <ZoruButton
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Archive
                </ZoruButton>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && rows.length === 0}
        pagination={
          filtered.length > 0 ? (
            <PaginationBar
              page={page}
              limit={PAGE_SIZE}
              hasMore={page < totalPages}
              total={filtered.length}
              controlled={{ onChange: (next) => setPage(next.page) }}
            />
          ) : null
        }
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ZoruStatCard
            label={`Total Deducted ${fyFilter ? `FY ${fyFilter}` : ''}`}
            value={`₹${kpis.totalDeducted.toLocaleString('en-IN')}`}
            period={`across ${rows.length} record${rows.length === 1 ? '' : 's'}`}
            icon={<Banknote />}
          />
          <ZoruStatCard
            label="Pending Challans"
            value={kpis.pendingChallans}
            period="awaiting deposit"
            icon={<AlertCircle />}
          />
          <ZoruStatCard
            label="Last Filing"
            value={
              kpis.lastFiling
                ? kpis.lastFiling.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'
            }
            period={kpis.lastFiling ? 'most recent filed' : 'no filings yet'}
            icon={<CalendarClock />}
          />
          <ZoruStatCard
            label="Top Employee"
            value={kpis.topEmployee?.name ?? '—'}
            period={
              kpis.topEmployee
                ? `₹${kpis.topEmployee.total.toLocaleString('en-IN')} TDS`
                : 'no data'
            }
            icon={<Trophy />}
          />
        </div>

        <ZoruCard className="p-6">
          <div className="mb-4">
            <h2 className="text-[16px] text-zoru-ink">TDS Deduction Details</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              Per-employee quarterly breakdown with certificate and challan
              tracking.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line bg-zoru-surface-2">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="h-4 w-4 accent-zoru-accent"
                    />
                  </th>
                  <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">
                    PAN
                  </th>
                  <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">
                    FY · Q
                  </th>
                  <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">
                    Gross
                  </th>
                  <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">
                    TDS
                  </th>
                  <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">
                    Challan
                  </th>
                  <th className="px-4 py-3 text-center text-[12px] uppercase text-zoru-ink-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="h-48 text-center">
                      <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-zoru-ink-muted" />
                    </td>
                  </tr>
                ) : paged.length > 0 ? (
                  paged.map((r) => {
                    const id = String(r._id);
                    const checked = selected.has(id);
                    return (
                      <tr
                        key={id}
                        className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors"
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${r.employeeName ?? id}`}
                            checked={checked}
                            onChange={() => toggleOne(id)}
                            className="h-4 w-4 accent-zoru-accent"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <EntityRowLink
                            href={`/dashboard/crm/hr-payroll/tds/${id}`}
                            label={r.employeeName ?? '—'}
                            subtitle={r.designation ?? undefined}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink">
                          {r.pan ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-zoru-ink">
                          {r.financialYear ?? '—'}
                          {r.quarter ? ` · ${r.quarter}` : ''}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                          ₹{Number(r.grossAmount ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                          {Number(r.tdsAmount ?? 0) > 0 ? (
                            `₹${Number(r.tdsAmount).toLocaleString('en-IN')}`
                          ) : (
                            <ZoruBadge variant="secondary">Nil</ZoruBadge>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink-muted">
                          {r.depositChallanNumber ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {statusBadge(r.status ?? 'pending')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ZoruButton
                            variant="outline"
                            size="icon"
                            aria-label="Archive"
                            onClick={() => setDeleteTargetId(id)}
                          >
                            <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                          </ZoruButton>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={9}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      {hasActiveFilters
                        ? 'No TDS records match the current filters.'
                        : 'No TDS records yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-zoru-line bg-zoru-surface-2">
                    <td colSpan={5} className="px-4 py-3 text-[12.5px] text-zoru-ink">
                      Total TDS (visible)
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-ink">
                      ₹
                      {filtered
                        .reduce((s, r) => s + Number(r.tdsAmount ?? 0), 0)
                        .toLocaleString('en-IN')}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </ZoruCard>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Archive this TDS record?"
        description="The record will be hidden from active views. You can restore it from the archived filter."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(o) => setBulkDeleteOpen(o)}
        title={`Archive ${selected.size} TDS record${selected.size === 1 ? '' : 's'}?`}
        description="The selected records will be marked archived."
        confirmLabel="Archive all"
        confirmTone="primary"
        onConfirm={runBulkDelete}
      />
    </>
  );
}
