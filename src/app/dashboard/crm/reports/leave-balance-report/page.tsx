export const dynamic = 'force-dynamic';

import * as React from 'react';

import {
  Badge,
  Card,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';

import { StatCard, fmtNumber } from '../_components/report-toolbar';
import { HrReportToolbar } from '../_components/hr-report-toolbar';
import { StackedBarChart } from '../_components/hr-report-charts';
import {
  getHrReportDepartments,
  getLeaveBalanceDeep,
} from '@/app/actions/crm-reports.actions';

interface PageProps {
  searchParams: Promise<{
    departmentId?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function LeaveBalanceReportPage(props: PageProps) {
  const sp = await props.searchParams;
  const page = Math.max(1, sp.page ? parseInt(sp.page, 10) : 1);
  const limit = Math.min(100, Math.max(5, sp.limit ? parseInt(sp.limit, 10) : 20));

  const [departments, report] = await Promise.all([
    getHrReportDepartments(),
    getLeaveBalanceDeep(sp.departmentId),
  ]);

  const { rows, stacked, typeKeys, totals } = report;

  const pageRows = rows.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < rows.length;

  const topByTypeLabel =
    totals.byType.length > 0
      ? `${totals.byType[0].label}: ${fmtNumber(totals.byType[0].value)}`
      : '—';

  const chartData = stacked.slice(0, 15);

  const exportHeaders = [
    'Employee',
    'Department',
    'Leave Type',
    'Allocated',
    'Used',
    'Remaining',
    'Expires',
  ];
  const exportRows = rows.map((r) => ({
    Employee: r.employeeName,
    Department: r.department,
    'Leave Type': r.leaveTypeName,
    Allocated: r.allocated,
    Used: r.used,
    Remaining: r.remaining,
    Expires: r.expiresAt ? r.expiresAt.slice(0, 10) : '',
  }));

  return (
    <EntityListShell
      title="Leave Balance"
      subtitle="Remaining leave balance per employee and leave type."
      primaryAction={
        <HrReportToolbar
          hideDateRange
          departmentId={sp.departmentId}
          departments={departments}
          exportProps={{
            filename: 'leave-balance',
            headers: exportHeaders,
            rows: exportRows,
            sheetName: 'LeaveBalance',
          }}
        />
      }
      pagination={
        <PaginationBar
          page={page}
          limit={limit}
          hasMore={hasMore}
          total={rows.length}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total days remaining"
          value={fmtNumber(totals.totalRemaining)}
          hint={`${fmtNumber(totals.employees)} employees`}
        />
        <StatCard
          label="Top leave type"
          value={topByTypeLabel}
          tone="blue"
        />
        <StatCard
          label="Low balance employees"
          value={fmtNumber(totals.lowBalanceCount)}
          tone="amber"
          hint="below 20% of allocation"
        />
        <StatCard
          label="Expiring within 90d"
          value={fmtNumber(totals.expiringSoonCount)}
          tone="red"
        />
      </div>

      <ZoruCard className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-foreground">
            Remaining leave by employee and type
          </h2>
          <span className="text-[12px] text-muted-foreground">
            Showing top {chartData.length} of {stacked.length}
          </span>
        </div>
        <StackedBarChart data={chartData} keys={typeKeys} />
      </ZoruCard>

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Employee</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Department</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Leave Type</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Allocated</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Used</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Remaining</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Expires</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No employees or leave types configured.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r, i) => {
                  const low = r.allocated > 0 && r.remaining / r.allocated < 0.2;
                  return (
                    <ZoruTableRow
                      key={`${r.employeeId}-${r.leaveTypeName}-${i}`}
                      className="border-border"
                    >
                      <ZoruTableCell>
                        <EntityRowLink
                          href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                          label={r.employeeName}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-foreground">
                        <ZoruBadge variant="outline">{r.department}</ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-foreground">
                        {r.leaveTypeName}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-foreground">
                        {r.allocated}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-amber-500">
                        {r.used}
                      </ZoruTableCell>
                      <ZoruTableCell
                        className={`text-right text-[13px] font-medium ${low ? 'text-destructive' : 'text-emerald-500'}`}
                      >
                        {r.remaining}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-muted-foreground">
                        {r.expiresAt ? r.expiresAt.slice(0, 10) : '—'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
