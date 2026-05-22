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
import {
  CategoryPieChart,
  MonthlyTrendChart,
} from '../_components/hr-report-charts';
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
        <ZoruCard className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-foreground">
              Leave days by type
            </h2>
            <span className="text-[12px] text-muted-foreground">
              {byType.length} type{byType.length === 1 ? '' : 's'}
            </span>
          </div>
          <CategoryPieChart data={byType} />
        </ZoruCard>

        <ZoruCard className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-foreground">
              Monthly leave trend
            </h2>
            <span className="text-[12px] text-muted-foreground">days</span>
          </div>
          <MonthlyTrendChart data={byMonth} label="Days" />
        </ZoruCard>
      </div>

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Employee</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Department</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Leave Type</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Reason</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Days</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Date</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No leaves in this range.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r, i) => (
                  <ZoruTableRow
                    key={`${r.employeeId}-${i}`}
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
                    <ZoruTableCell className="max-w-[240px] truncate text-[13px] text-muted-foreground">
                      {r.reason}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                      {r.days}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={statusVariant(r.status)}>
                        {r.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-muted-foreground">
                      {r.leaveDate ? r.leaveDate.slice(0, 10) : '—'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
