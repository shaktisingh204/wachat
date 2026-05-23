export const dynamic = 'force-dynamic';

import * as React from 'react';

import { Card } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

import { StatCard, fmtNumber } from '../_components/report-toolbar';
import { HrReportToolbar } from '../_components/hr-report-toolbar';
import dynamic from 'next/dynamic';
import { AttendanceView } from './attendance-view';
import {
  getHrReportDepartments,
  getAttendanceReportData,
} from '@/app/actions/crm-reports.actions';

const DailyAttendanceChart = dynamic(
  () => import('../_components/hr-report-charts').then((mod) => mod.DailyAttendanceChart),
  { ssr: false }
);

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

      <Card className="p-6 mb-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-foreground">
            Daily attendance
          </h2>
          <span className="text-[12px] text-muted-foreground">
            {fmtNumber(totals.presentCount)} present · {fmtNumber(totals.absentCount)} absent · {fmtNumber(totals.leaveCount)} on leave
          </span>
        </div>
        <DailyAttendanceChart data={daily} />
      </Card>

      <AttendanceView
        pageRows={pageRows}
        daily={daily}
        page={page}
        limit={limit}
        total={rows.length}
        month={month}
        year={year}
      />
    </EntityListShell>
  );
}
