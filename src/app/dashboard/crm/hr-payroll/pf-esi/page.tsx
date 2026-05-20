'use client';

/**
 * PF & ESI Compliance — deepened list per Deep template (ref
 * src/app/dashboard/crm/sales-crm/all-leads/page.tsx).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards: contributions MTD, enrolled, pending UAN, pending ESI)
 *     • Filter row (search + period select + department)
 *     • Bulk action bar (export selection) + per-row select
 *     • CSV export (all or selection) + XLSX export (SYLK-compatible TSV)
 *     • Pagination (PaginationBar)
 *     • EntityRowLink on the employee cell
 *
 * Multi-tenant via getSession() inside the underlying server actions
 * (getPayslips / getCrmEmployees) — both already gate on session.
 */

import * as React from 'react';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import { Download, LoaderCircle, Wallet, Users, ShieldAlert, FileWarning } from 'lucide-react';
import { startOfMonth } from 'date-fns';
import { useDebouncedCallback } from 'use-debounce';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' },
];

const PF_RATE = 12;
const ESI_RATE = 0.75;
const ESI_WAGE_CEILING = 21000;
const ROWS_PER_PAGE = 20;

type PfEsiStatusFilter = 'all' | 'esi-applicable' | 'esi-na' | 'missing-uan' | 'missing-esi';

type PfEsiRow = {
  _id: string;
  employeeId: string;
  employeeName: string;
  designationName: string;
  departmentName: string;
  grossSalary: number;
  basic: number;
  pf: number;
  esi: number;
  pfRate: string;
  esiRate: string;
  esiApplicable: boolean;
  pfNumber: string;
  esiNumber: string;
  uan: string;
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function PfEsiPage() {
  const [rows, setRows] = React.useState<PfEsiRow[]>([]);
  const [isLoading, startTransition] = React.useTransition();
  const [month, setMonth] = React.useState(new Date().getMonth());
  const [year, setYear] = React.useState(currentYear);
  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<PfEsiStatusFilter>('all');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [page, setPage] = React.useState(1);

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      const period = startOfMonth(new Date(year, month));
      const [payslipsData, employeesData] = await Promise.all([
        getPayslips(period),
        getCrmEmployees(),
      ]);
      const employeeMap = new Map(employeesData.map((e: any) => [String(e._id), e]));

      const enriched: PfEsiRow[] = payslipsData.map((slip: any) => {
        const emp: any = employeeMap.get(String(slip.employeeId));
        const pf =
          slip.deductions?.find(
            (d: any) => d.name?.includes('PF') || d.name?.includes('Provident'),
          )?.amount ?? 0;
        const esi = slip.deductions?.find((d: any) => d.name?.includes('ESI'))?.amount ?? 0;
        const basic =
          slip.earnings?.find((e: any) => e.name?.toLowerCase?.().includes('basic'))?.amount ?? 0;
        const pfRate = basic > 0 ? ((pf / basic) * 100).toFixed(2) : PF_RATE.toFixed(2);
        const esiRate =
          slip.grossSalary > 0 ? ((esi / slip.grossSalary) * 100).toFixed(2) : ESI_RATE.toFixed(2);
        const esiApplicable = (slip.grossSalary ?? 0) <= ESI_WAGE_CEILING;
        const employeeName =
          [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim() || 'Unnamed';
        return {
          _id: String(slip._id ?? slip.employeeId),
          employeeId: String(slip.employeeId ?? ''),
          employeeName,
          designationName: emp?.designationName ?? '',
          departmentName: emp?.departmentName ?? '',
          grossSalary: slip.grossSalary ?? 0,
          basic,
          pf,
          esi,
          pfRate,
          esiRate,
          esiApplicable,
          pfNumber: emp?.pfNumber ?? '',
          esiNumber: emp?.esiNumber ?? '',
          uan: emp?.uan ?? '',
        };
      });

      setRows(enriched);
      setPage(1);
      setSelected(new Set());
    });
  }, [month, year]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const debouncedSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const departments = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.departmentName) set.add(r.departmentName);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const haystack = [
          r.employeeName,
          r.designationName,
          r.departmentName,
          r.pfNumber,
          r.esiNumber,
          r.uan,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (departmentFilter !== 'all' && r.departmentName !== departmentFilter) return false;
      switch (statusFilter) {
        case 'esi-applicable':
          if (!r.esiApplicable) return false;
          break;
        case 'esi-na':
          if (r.esiApplicable) return false;
          break;
        case 'missing-uan':
          if (r.uan && r.uan !== '—') return false;
          break;
        case 'missing-esi':
          if (r.esiNumber && r.esiNumber !== '—') return false;
          break;
      }
      return true;
    });
  }, [rows, search, statusFilter, departmentFilter]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const pageRows = React.useMemo(
    () => filteredRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [filteredRows, page],
  );

  // KPIs computed over the *filtered* set so they reflect current view.
  const kpis = React.useMemo(() => {
    const totalContrib = filteredRows.reduce((s, r) => s + r.pf + r.esi, 0);
    const enrolled = filteredRows.filter((r) => r.pfNumber && r.pfNumber !== '—').length;
    const pendingUan = filteredRows.filter((r) => !r.uan || r.uan === '—').length;
    const pendingEsi = filteredRows.filter(
      (r) => r.esiApplicable && (!r.esiNumber || r.esiNumber === '—'),
    ).length;
    return { totalContrib, enrolled, pendingUan, pendingEsi };
  }, [filteredRows]);

  const periodLabel = `${months.find((m) => m.value === month)?.label} ${year}`;

  // ── Selection ───────────────────────────────────────────────────────
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

  // ── Export helpers ──────────────────────────────────────────────────
  const exportRows = React.useCallback(
    (format: 'csv' | 'xlsx') => {
      const source =
        selected.size > 0 ? filteredRows.filter((r) => selected.has(r._id)) : filteredRows;
      const header = [
        'Employee',
        'Department',
        'Designation',
        'Gross Salary',
        'Basic',
        'PF Rate %',
        'PF Amount',
        'ESI Applicable',
        'ESI Rate %',
        'ESI Amount',
        'PF Number',
        'ESI Number',
        'UAN',
        'Period',
      ];
      const sep = format === 'xlsx' ? '\t' : ',';
      const escape = (v: unknown) => {
        const s = String(v ?? '');
        if (format === 'xlsx') return s.replace(/\t|\r|\n/g, ' ');
        return `"${s.replace(/"/g, '""')}"`;
      };
      const lines = [
        header.join(sep),
        ...source.map((r) =>
          [
            r.employeeName,
            r.departmentName || '—',
            r.designationName || '—',
            r.grossSalary,
            r.basic,
            r.pfRate,
            r.pf,
            r.esiApplicable ? 'Yes' : 'No',
            r.esiApplicable ? r.esiRate : 'N/A',
            r.esiApplicable ? r.esi : 0,
            r.pfNumber || '—',
            r.esiNumber || '—',
            r.uan || '—',
            periodLabel,
          ]
            .map(escape)
            .join(sep),
        ),
      ];
      const mime =
        format === 'xlsx'
          ? 'application/vnd.ms-excel;charset=utf-8;'
          : 'text/csv;charset=utf-8;';
      const blob = new Blob([lines.join('\n')], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pf-esi-${year}-${String(month + 1).padStart(2, '0')}.${format === 'xlsx' ? 'xls' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [filteredRows, selected, month, year, periodLabel],
  );

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setSearchInput('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setPage(1);
  }, []);

  const hasActiveFilters =
    !!search || statusFilter !== 'all' || departmentFilter !== 'all';

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));

  return (
    <EntityListShell
      title="PF & ESI Compliance"
      subtitle={`Provident Fund and Employee State Insurance contributions for ${periodLabel}.`}
      search={{
        value: searchInput,
        onChange: (v) => {
          setSearchInput(v);
          debouncedSearch(v);
        },
        placeholder: 'Search employee, UAN, PF/ESI number…',
      }}
      primaryAction={
        <div className="flex flex-wrap items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={() => exportRows('csv')}>
            <Download className="h-4 w-4" /> CSV
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" onClick={() => exportRows('xlsx')}>
            <Download className="h-4 w-4" /> XLSX
          </ZoruButton>
        </div>
      }
      filters={
        <>
          <ZoruSelect value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <ZoruSelectTrigger className="h-9 w-36 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {months.map((m) => (
                <ZoruSelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
          <ZoruSelect value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <ZoruSelectTrigger className="h-9 w-28 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {years.map((y) => (
                <ZoruSelectItem key={y} value={String(y)}>
                  {y}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
          <ZoruSelect
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as PfEsiStatusFilter);
              setPage(1);
            }}
          >
            <ZoruSelectTrigger className="h-9 w-44 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
              <ZoruSelectValue placeholder="Status" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
              <ZoruSelectItem value="esi-applicable">ESI applicable</ZoruSelectItem>
              <ZoruSelectItem value="esi-na">ESI not applicable</ZoruSelectItem>
              <ZoruSelectItem value="missing-uan">Missing UAN</ZoruSelectItem>
              <ZoruSelectItem value="missing-esi">Missing ESI number</ZoruSelectItem>
            </ZoruSelectContent>
          </ZoruSelect>
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
              {selected.size} row{selected.size === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center gap-2">
              <ZoruButton variant="outline" size="sm" onClick={() => exportRows('csv')}>
                <Download className="h-4 w-4" /> Export CSV
              </ZoruButton>
              <ZoruButton variant="outline" size="sm" onClick={() => exportRows('xlsx')}>
                <Download className="h-4 w-4" /> Export XLSX
              </ZoruButton>
              <ZoruButton variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
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
      loading={isLoading && rows.length === 0}
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Wallet className="h-4 w-4" />}
            label="Total contributions"
            value={inr(kpis.totalContrib)}
            hint={`PF + ESI for ${periodLabel}`}
          />
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            label="Employees enrolled"
            value={kpis.enrolled.toLocaleString('en-IN')}
            hint={`${filteredRows.length} payroll rows`}
          />
          <KpiCard
            icon={<FileWarning className="h-4 w-4" />}
            label="Pending UAN"
            value={kpis.pendingUan.toLocaleString('en-IN')}
            hint="Missing Universal Account Number"
            tone={kpis.pendingUan > 0 ? 'warn' : 'default'}
          />
          <KpiCard
            icon={<ShieldAlert className="h-4 w-4" />}
            label="Pending ESI"
            value={kpis.pendingEsi.toLocaleString('en-IN')}
            hint="ESI applicable, number missing"
            tone={kpis.pendingEsi > 0 ? 'warn' : 'default'}
          />
        </div>

        {/* Table card */}
        <ZoruCard className="p-6">
          <div className="mb-4">
            <h2 className="text-[16px] text-zoru-ink">Employee PF &amp; ESI Breakdown</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              Contribution details, registration numbers, and UAN per employee.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line bg-zoru-surface-2">
                  <th className="w-10 px-3 py-3">
                    <ZoruCheckbox
                      checked={allOnPageSelected}
                      onCheckedChange={(c) => toggleAll(Boolean(c))}
                      aria-label="Select all on page"
                    />
                  </th>
                  <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Employee</th>
                  <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">
                    Gross
                  </th>
                  <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">
                    PF %
                  </th>
                  <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">
                    PF Amount
                  </th>
                  <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">
                    ESI %
                  </th>
                  <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">
                    ESI Amount
                  </th>
                  <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">PF Number</th>
                  <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">
                    ESI Number
                  </th>
                  <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">UAN</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="h-48 text-center">
                      <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-zoru-ink-muted" />
                    </td>
                  </tr>
                ) : pageRows.length > 0 ? (
                  pageRows.map((row) => {
                    const isSelected = selected.has(row._id);
                    return (
                      <tr
                        key={row._id}
                        className="border-b border-zoru-line transition-colors last:border-0 hover:bg-zoru-surface-2/50"
                      >
                        <td className="px-3 py-3">
                          <ZoruCheckbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(row._id)}
                            aria-label={`Select ${row.employeeName}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {row.employeeId ? (
                            <EntityRowLink
                              href={`/dashboard/crm/hr-payroll/employees/${row.employeeId}`}
                              label={row.employeeName}
                              subtitle={row.designationName || row.departmentName || '—'}
                            />
                          ) : (
                            <div>
                              <div className="font-medium text-zoru-ink">{row.employeeName}</div>
                              <div className="text-[11.5px] text-zoru-ink-muted">
                                {row.designationName || row.departmentName || '—'}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                          {inr(row.grossSalary)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                          {row.pfRate}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                          {inr(row.pf)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                          {row.esiApplicable ? (
                            `${row.esiRate}%`
                          ) : (
                            <ZoruBadge variant="secondary">N/A</ZoruBadge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                          {row.esiApplicable ? inr(row.esi) : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink-muted">
                          {row.pfNumber || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink-muted">
                          {row.esiNumber || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink-muted">
                          {row.uan || '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={10}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      {hasActiveFilters
                        ? 'No rows match the current filters.'
                        : `No payroll data for ${periodLabel}. Generate payroll first.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ZoruCard>
      </div>
    </EntityListShell>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warn';
}) {
  const valueClass =
    tone === 'warn' ? 'text-zoru-warning-ink' : 'text-zoru-ink';
  return (
    <ZoruCard className="p-5">
      <div className="flex items-center gap-2 text-zoru-ink-muted">
        {icon}
        <p className="text-[12.5px] font-medium">{label}</p>
      </div>
      <div className={`mt-2 text-2xl ${valueClass}`}>{value}</div>
      {hint ? <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{hint}</p> : null}
    </ZoruCard>
  );
}
