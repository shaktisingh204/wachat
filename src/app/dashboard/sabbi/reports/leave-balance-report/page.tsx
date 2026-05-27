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

      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-zoru-ink">
            Remaining leave by employee and type
          </h2>
          <span className="text-[12px] text-zoru-ink-muted">
            Showing top {chartData.length} of {stacked.length}
          </span>
        </div>
        <StackedBarChart data={chartData} keys={typeKeys} />
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Department</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Leave Type</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Allocated</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Used</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Remaining</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Expires</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No employees or leave types configured.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r, i) => {
                  const low = r.allocated > 0 && r.remaining / r.allocated < 0.2;
                  const isNegative = r.remaining < 0;
                  return (
                    <ZoruTableRow
                      key={`${r.employeeId}-${r.leaveTypeName}-${i}`}
                      className={`border-zoru-line ${isNegative ? 'bg-zoru-ink/10 hover:bg-zoru-ink/20' : ''}`}
                    >
                      <ZoruTableCell>
                        <EntityRowLink
                          href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                          label={r.employeeName}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        <Badge variant="outline">{r.department}</Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {r.leaveTypeName}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                        {r.allocated}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                        {r.used}
                      </ZoruTableCell>
                      <ZoruTableCell
                        className={`text-right text-[13px] font-medium ${low ? 'text-zoru-ink' : 'text-zoru-ink'}`}
                      >
                        {r.remaining}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-ink-muted">
                        {r.expiresAt ? r.expiresAt.slice(0, 10) : '—'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
