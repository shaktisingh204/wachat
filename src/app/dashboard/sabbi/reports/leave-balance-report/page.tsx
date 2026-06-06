export const dynamic = 'force-dynamic';

import * as React from 'react';

import { Badge, Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
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
          <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
            Remaining leave by employee and type
          </h2>
          <span className="text-[12px] text-[var(--st-text-secondary)]">
            Showing top {chartData.length} of {stacked.length}
          </span>
        </div>
        <StackedBarChart data={chartData} keys={typeKeys} />
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">Employee</Th>
                <Th className="text-[var(--st-text-secondary)]">Department</Th>
                <Th className="text-[var(--st-text-secondary)]">Leave Type</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Allocated</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Used</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Remaining</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Expires</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No employees or leave types configured.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r, i) => {
                  const low = r.allocated > 0 && r.remaining / r.allocated < 0.2;
                  const isNegative = r.remaining < 0;
                  return (
                    <Tr
                      key={`${r.employeeId}-${r.leaveTypeName}-${i}`}
                      className={`border-[var(--st-border)] ${isNegative ? 'bg-[var(--st-text)]/10 hover:bg-[var(--st-text)]/20' : ''}`}
                    >
                      <Td>
                        <EntityRowLink
                          href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                          label={r.employeeName}
                        />
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text)]">
                        <Badge variant="outline">{r.department}</Badge>
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text)]">
                        {r.leaveTypeName}
                      </Td>
                      <Td className="text-right text-[13px] text-[var(--st-text)]">
                        {r.allocated}
                      </Td>
                      <Td className="text-right text-[13px] text-[var(--st-text)]">
                        {r.used}
                      </Td>
                      <Td
                        className={`text-right text-[13px] font-medium ${low ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'}`}
                      >
                        {r.remaining}
                      </Td>
                      <Td className="text-right text-[13px] text-[var(--st-text-secondary)]">
                        {r.expiresAt ? r.expiresAt.slice(0, 10) : '—'}
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
