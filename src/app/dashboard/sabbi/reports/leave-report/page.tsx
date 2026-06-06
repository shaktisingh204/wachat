export const dynamic = 'force-dynamic';

import * as React from 'react';

import { Badge, Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';

import { StatCard, fmtNumber } from '../_components/report-toolbar';
import { HrReportToolbar } from '../_components/hr-report-toolbar';
import { CategoryPieChart, MonthlyTrendChart } from '../_components/hr-report-charts';
import {
  getHrReportDepartments,
  getLeaveReportDeep,
} from '@/app/actions/crm-reports.actions';

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    departmentId?: string;
    page?: string;
    limit?: string;
  }>;
}

function statusVariant(
  status: 'approved' | 'pending' | 'rejected' | 'cancelled',
): 'success' | 'warning' | 'destructive' | 'outline' {
  if (status === 'approved') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'rejected') return 'destructive';
  return 'outline';
}

export default async function LeaveReportPage(props: PageProps) {
  const sp = await props.searchParams;
  const page = Math.max(1, sp.page ? parseInt(sp.page, 10) : 1);
  const limit = Math.min(100, Math.max(5, sp.limit ? parseInt(sp.limit, 10) : 20));

  const [departments, report] = await Promise.all([
    getHrReportDepartments(),
    getLeaveReportDeep(sp.from, sp.to, sp.departmentId),
  ]);

  const { rows, byType, byMonth, totals } = report;

  const pageRows = rows.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < rows.length;

  const exportHeaders = [
    'Employee',
    'Department',
    'Leave Type',
    'Reason',
    'Days',
    'Status',
    'Date',
  ];
  const exportRows = rows.map((r) => ({
    Employee: r.employeeName,
    Department: r.department,
    'Leave Type': r.leaveTypeName,
    Reason: r.reason,
    Days: r.days,
    Status: r.status,
    Date: r.leaveDate ? r.leaveDate.slice(0, 10) : '',
  }));

  return (
    <EntityListShell
      title="Leave Report"
      subtitle="Leaves taken — by employee, leave type and status."
      primaryAction={
        <HrReportToolbar
          from={sp.from}
          to={sp.to}
          departmentId={sp.departmentId}
          departments={departments}
          exportProps={{
            filename: 'leave-report',
            headers: exportHeaders,
            rows: exportRows,
            sheetName: 'Leaves',
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
          label="Total leaves"
          value={fmtNumber(totals.totalLeaves)}
        />
        <StatCard
          label="Approved"
          value={fmtNumber(totals.approved)}
          tone="green"
        />
        <StatCard
          label="Pending"
          value={fmtNumber(totals.pending)}
          tone="amber"
        />
        <StatCard
          label="Top reason"
          value={totals.topReason}
          tone="blue"
          hint={`${fmtNumber(totals.rejected)} rejected`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              Leave days by type
            </h2>
            <span className="text-[12px] text-[var(--st-text-secondary)]">
              {byType.length} type{byType.length === 1 ? '' : 's'}
            </span>
          </div>
          <CategoryPieChart data={byType} />
        </Card>

        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              Monthly leave trend
            </h2>
            <span className="text-[12px] text-[var(--st-text-secondary)]">days</span>
          </div>
          <MonthlyTrendChart data={byMonth} label="Days" />
        </Card>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">Employee</Th>
                <Th className="text-[var(--st-text-secondary)]">Department</Th>
                <Th className="text-[var(--st-text-secondary)]">Leave Type</Th>
                <Th className="text-[var(--st-text-secondary)]">Reason</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Days</Th>
                <Th className="text-[var(--st-text-secondary)]">Status</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Date</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No leaves in this range.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r, i) => (
                  <Tr
                    key={`${r.employeeId}-${i}`}
                    className="border-[var(--st-border)]"
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
                    <Td className="max-w-[240px] truncate text-[13px] text-[var(--st-text-secondary)]">
                      {r.reason}
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                      {r.days}
                    </Td>
                    <Td>
                      <Badge variant={statusVariant(r.status)}>
                        {r.status}
                      </Badge>
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text-secondary)]">
                      {r.leaveDate ? r.leaveDate.slice(0, 10) : '—'}
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
