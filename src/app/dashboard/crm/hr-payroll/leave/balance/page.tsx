'use client';

/**
 * Leave Balance — per-employee remaining-leaves matrix.
 *
 * Multi-tenant: data flows through `getLeaveBalance`, `getLeaveTypes`,
 * `getCrmDepartments`, `getCrmEmployees`, each tenant-scoped server-side.
 *
 * KPIs (computed from the loaded balance matrix):
 *   - Total employees
 *   - Low-balance count (any employee with any allocated type at remaining <= 1)
 *   - By leave type — average remaining
 *   - Top consumed leave type
 *
 * Filters: search by employee name, department filter, low-balance toggle.
 * Export: CSV / XLSX via `crm-list-export` — wide row per employee.
 */

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Flame,
  TrendingDown,
  Users,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
  getLeaveBalance,
  getLeaveTypes,
} from '@/app/actions/worksuite/leave.actions';
import {
  getCrmEmployees,
  getCrmDepartments,
} from '@/app/actions/crm-employees.actions';
import type {
  WsLeaveBalanceEmployee,
  WsLeaveType,
} from '@/lib/worksuite/leave-types';
import type { WithId, CrmDepartment } from '@/lib/definitions';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';

const PAGE_SIZE = 25;

type EmployeeLite = {
  _id: string | { toString(): string };
  departmentId?: string | { toString(): string } | null;
};

export default function LeaveBalancePage() {
  const [rows, setRows] = useState<WsLeaveBalanceEmployee[]>([]);
  const [types, setTypes] = useState<WsLeaveType[]>([]);
  const [departments, setDepartments] = useState<WithId<CrmDepartment>[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [isLoading, startTransition] = useTransition();

  const [q, setQ] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    startTransition(async () => {
      const [balances, ts, deps, emps] = await Promise.all([
        getLeaveBalance(),
        getLeaveTypes(),
        getCrmDepartments(),
        getCrmEmployees(),
      ]);
      setRows(balances);
      setTypes(ts);
      setDepartments(deps);
      setEmployees(emps as EmployeeLite[]);
    });
  }, []);

  const empDeptMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) {
      m.set(String(e._id), e.departmentId ? String(e.departmentId) : '');
    }
    return m;
  }, [employees]);

  const isLow = (r: WsLeaveBalanceEmployee) =>
    r.rows.some((x) => x.allocated > 0 && x.remaining <= 1);

  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && !r.employee_name.toLowerCase().includes(needle)) return false;
      if (departmentFilter !== 'all') {
        const dep = empDeptMap.get(r.employee_id) ?? '';
        if (dep !== departmentFilter) return false;
      }
      if (lowOnly && !isLow(r)) return false;
      return true;
    });
  }, [rows, q, departmentFilter, lowOnly, empDeptMap]);

  // KPIs
  const kpiTotal = filteredRows.length;
  const kpiLow = filteredRows.filter(isLow).length;

  const kpiAvgByType = useMemo(() => {
    const m = new Map<string, { name: string; total: number; count: number }>();
    for (const r of filteredRows) {
      for (const x of r.rows) {
        if (x.allocated <= 0) continue;
        const k = x.leave_type_id;
        const cur = m.get(k) ?? { name: x.type_name, total: 0, count: 0 };
        cur.total += x.remaining;
        cur.count += 1;
        m.set(k, cur);
      }
    }
    return Array.from(m.values())
      .map((v) => ({ name: v.name, avg: v.count > 0 ? v.total / v.count : 0 }))
      .sort((a, b) => a.avg - b.avg);
  }, [filteredRows]);

  const kpiTopConsumed = useMemo(() => {
    const m = new Map<string, { name: string; used: number }>();
    for (const r of filteredRows) {
      for (const x of r.rows) {
        const cur = m.get(x.leave_type_id) ?? { name: x.type_name, used: 0 };
        cur.used += x.used;
        m.set(x.leave_type_id, cur);
      }
    }
    return Array.from(m.values()).sort((a, b) => b.used - a.used)[0];
  }, [filteredRows]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filteredRows.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [filteredRows, pageSafe],
  );

  useEffect(() => {
    setPage(1);
  }, [q, departmentFilter, lowOnly]);

  // Export
  const buildExport = (): { headers: string[]; rows: ExportRow[] } => {
    const headers = [
      'Employee',
      'Department',
      ...types.flatMap((t) => [
        `${t.type_name} — Allocated`,
        `${t.type_name} — Used`,
        `${t.type_name} — Remaining`,
      ]),
    ];
    const deptNameMap = new Map<string, string>();
    for (const d of departments) deptNameMap.set(String(d._id), d.name);

    const out: ExportRow[] = filteredRows.map((r) => {
      const byType = new Map(r.rows.map((x) => [x.leave_type_id, x]));
      const dep = empDeptMap.get(r.employee_id) ?? '';
      const row: ExportRow = {
        Employee: r.employee_name,
        Department: dep ? (deptNameMap.get(dep) ?? '') : '',
      };
      for (const t of types) {
        const x = byType.get(String(t._id));
        row[`${t.type_name} — Allocated`] = x?.allocated ?? 0;
        row[`${t.type_name} — Used`] = x?.used ?? 0;
        row[`${t.type_name} — Remaining`] = x?.remaining ?? 0;
      }
      return row;
    });
    return { headers, rows: out };
  };

  const onExportCsv = () => {
    const { headers, rows: r } = buildExport();
    downloadCsv(`leave-balance-${dateStamp()}.csv`, headers, r);
  };
  const onExportXlsx = () => {
    const { headers, rows: r } = buildExport();
    void downloadXlsx(`leave-balance-${dateStamp()}.xlsx`, headers, r, 'Leave Balance');
  };

  return (
    <EntityListShell
      title="Leave Balance"
      subtitle="Per-employee remaining leaves across every leave type."
      search={{ value: q, onChange: setQ, placeholder: 'Search employees…' }}
      primaryAction={
        <div className="flex items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={onExportCsv}>
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            CSV
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" onClick={onExportXlsx}>
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
            XLSX
          </ZoruButton>
        </div>
      }
      filters={
        <>
          <div className="w-48">
            <ZoruSelect value={departmentFilter} onValueChange={setDepartmentFilter}>
              <ZoruSelectTrigger>
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
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zoru-line px-3 py-1.5 text-[12.5px] text-zoru-ink-muted">
            <ZoruCheckbox
              checked={lowOnly}
              onCheckedChange={(c) => setLowOnly(Boolean(c))}
              aria-label="Low-balance only"
            />
            Low-balance only
          </label>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            label="Total employees"
            value={kpiTotal.toLocaleString('en-IN')}
            hint="After filters"
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Low balance"
            value={kpiLow.toLocaleString('en-IN')}
            hint="Employees with any type at ≤ 1 remaining"
          />
          <KpiCard
            icon={<TrendingDown className="h-4 w-4" />}
            label="Avg remaining by type"
            value={
              kpiAvgByType.length === 0
                ? '0'
                : kpiAvgByType[0].avg.toFixed(1)
            }
            hint={
              kpiAvgByType.length === 0
                ? 'No allocations'
                : `${kpiAvgByType[0].name} (lowest)`
            }
          />
          <KpiCard
            icon={<Flame className="h-4 w-4" />}
            label="Top consumed"
            value={kpiTopConsumed ? kpiTopConsumed.used.toLocaleString('en-IN') : '0'}
            hint={kpiTopConsumed ? kpiTopConsumed.name : 'No leaves taken'}
          />
        </div>

        <ZoruCard className="p-6">
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line bg-zoru-surface-2">
                  <th className="px-4 py-3 text-zoru-ink-muted">Employee</th>
                  {types.map((t) => (
                    <th
                      key={String(t._id)}
                      className="px-4 py-3 text-zoru-ink-muted"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: t.color || '#94A3B8' }}
                        />
                        {t.type_name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={types.length + 1}
                      className="h-24 text-center text-zoru-ink-muted"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={types.length + 1}
                      className="h-24 text-center text-zoru-ink-muted"
                    >
                      No employees match the current filters.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const byType = new Map(r.rows.map((x) => [x.leave_type_id, x]));
                    const low = isLow(r);
                    return (
                      <tr
                        key={r.employee_id}
                        className="border-b border-zoru-line last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <EntityRowLink
                              href={`/dashboard/crm/hr-payroll/employees/${r.employee_id}`}
                              label={r.employee_name}
                            />
                            {low ? (
                              <ZoruBadge variant="warning">low</ZoruBadge>
                            ) : null}
                          </div>
                        </td>
                        {types.map((t) => {
                          const row = byType.get(String(t._id));
                          if (!row) {
                            return (
                              <td
                                key={String(t._id)}
                                className="px-4 py-3 text-zoru-ink-muted"
                              >
                                —
                              </td>
                            );
                          }
                          const cellLow = row.remaining <= 1 && row.allocated > 0;
                          return (
                            <td key={String(t._id)} className="px-4 py-3">
                              <div className="flex flex-col">
                                <span
                                  className={
                                    cellLow ? 'text-red-500' : 'text-zoru-ink'
                                  }
                                >
                                  {row.remaining} / {row.allocated}
                                </span>
                                <span className="text-[11px] text-zoru-ink-muted">
                                  used: {row.used}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredRows.length > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between text-[12.5px] text-zoru-ink-muted">
              <span>
                Page {pageSafe} of {totalPages} · {filteredRows.length} employees
              </span>
              <div className="flex items-center gap-2">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </ZoruButton>
              </div>
            </div>
          ) : null}
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
      <div className="mt-2 text-2xl text-zoru-ink">{value}</div>
      {hint ? (
        <p className="mt-1 truncate text-[11.5px] text-zoru-ink-muted" title={hint}>
          {hint}
        </p>
      ) : null}
    </ZoruCard>
  );
}
