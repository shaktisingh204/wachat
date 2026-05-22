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
import { DailyAttendanceChart } from '../_components/hr-report-charts';
import {
  getHrReportDepartments,
  getAttendanceReportData,
} from '@/app/actions/crm-reports.actions';

interface PageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
    departmentId?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function AttendanceReportPage(props: PageProps) {
  const sp = await props.searchParams;
  const now = new Date();
  const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1;
  const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear();
  const page = Math.max(1, sp.page ? parseInt(sp.page, 10) : 1);
  const limit = Math.min(100, Math.max(5, sp.limit ? parseInt(sp.limit, 10) : 20));

  const [departments, data] = await Promise.all([
    getHrReportDepartments(),
    getAttendanceReportData(month, year, sp.departmentId),
  ]);

  const { rows, daily, totals } = data;

  const pageRows = rows.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < rows.length;

  const exportHeaders = [
    'Employee',
    'Department',
    'Present',
    'Absent',
    'Late',
    'Leave',
    'Attendance %',
  ];
  const exportRows = rows.map((r) => ({
    Employee: r.employeeName,
    Department: r.department,
    Present: r.present,
    Absent: r.absent,
    Late: r.late,
    Leave: r.leave,
    'Attendance %': r.attendancePct.toFixed(1),
  }));

  return (
    <EntityListShell
      title="Attendance Report"
      subtitle={`Daily attendance for ${new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}.`}
      primaryAction={
        <HrReportToolbar
          monthPicker={{ month, year }}
          departmentId={sp.departmentId}
          departments={departments}
          exportProps={{
            filename: 'attendance-report',
            headers: exportHeaders,
            rows: exportRows,
            sheetName: 'Attendance',
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
          label="Total employees"
          value={fmtNumber(totals.totalEmployees)}
        />
        <StatCard
          label="Avg attendance"
          value={`${totals.avgAttendancePct.toFixed(1)}%`}
          tone={totals.avgAttendancePct >= 90 ? 'green' : 'amber'}
        />
        <StatCard
          label="Late this period"
          value={fmtNumber(totals.lateCount)}
          tone="amber"
        />
        <StatCard
          label="Absent this period"
          value={fmtNumber(totals.absentCount)}
          tone="red"
        />
      </div>

      <ZoruCard className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-foreground">
            Daily attendance
          </h2>
          <span className="text-[12px] text-muted-foreground">
            {fmtNumber(totals.presentCount)} present · {fmtNumber(totals.absentCount)} absent · {fmtNumber(totals.leaveCount)} on leave
          </span>
        </div>
        <DailyAttendanceChart data={daily} />
      </ZoruCard>

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Employee</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Department</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Present</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Absent</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Late</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Leave</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Attendance %</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No attendance data.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r) => (
                  <ZoruTableRow key={r.employeeId} className="border-border">
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                        label={r.employeeName}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      <ZoruBadge variant="outline">{r.department}</ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-emerald-500">
                      {r.present}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-destructive">
                      {r.absent}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-amber-500">
                      {r.late}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-sky-500">
                      {r.leave}
                    </ZoruTableCell>
                    <ZoruTableCell
                      className={`text-right text-[13px] font-medium ${r.attendancePct >= 90 ? 'text-emerald-500' : r.attendancePct >= 75 ? 'text-amber-500' : 'text-destructive'}`}
                    >
                      {r.attendancePct.toFixed(1)}%
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
