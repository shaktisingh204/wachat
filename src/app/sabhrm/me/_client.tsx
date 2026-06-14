"use client";

import * as React from "react";
import { CalendarDays, Clock, Receipt, UserRound } from "lucide-react";

import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  type DataTableColumn,
} from "@/components/sabcrm/20ui";
import { SabHrmPageShell, statusTone, formatMoney } from "@/components/sabhrm/page-toolkit";
import type { MyHrmSpace } from "@/app/actions/sabhrm/me.actions";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  type LeaveRequestRow,
  type AttendanceRow,
  type PayslipRow,
} from "@/lib/sabhrm/types";

const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
  late: "Late",
  on_leave: "On leave",
  holiday: "Holiday",
  week_off: "Week off",
};

const PAYSLIP_STATUS_LABELS: Record<string, string> = {
  generated: "Generated",
  sent: "Sent",
};

function toneBadge(status: string, label: string) {
  return <Badge variant={TONE_BADGE[statusTone(status)]}>{label}</Badge>;
}

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm text-[var(--st-text)]">{value ?? "—"}</div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] px-4 py-3">
        <span className="text-[var(--st-text-secondary)]">{icon}</span>
        <h2 className="text-sm font-semibold text-[var(--st-text)]">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

export function MyHrmSpaceClient({ data }: { data: MyHrmSpace }) {
  const { employee, leaveRequests, attendance, payslips } = data;

  const leaveColumns: DataTableColumn<LeaveRequestRow>[] = [
    { key: "leaveTypeName", header: "Type", render: (r) => r.leaveTypeName || "—" },
    { key: "from", header: "From", render: (r) => r.from || "—" },
    { key: "to", header: "To", render: (r) => r.to || "—" },
    { key: "days", header: "Days", align: "right", render: (r) => <span className="tabular-nums">{r.days}</span> },
    {
      key: "status",
      header: "Status",
      render: (r) => toneBadge(r.status, LEAVE_STATUS_LABELS[r.status] ?? r.status),
    },
    { key: "appliedAt", header: "Applied", render: (r) => r.appliedAt || "—" },
  ];

  const attendanceColumns: DataTableColumn<AttendanceRow>[] = [
    { key: "date", header: "Date", render: (r) => r.date || "—" },
    {
      key: "status",
      header: "Status",
      render: (r) => toneBadge(r.status, ATTENDANCE_STATUS_LABELS[r.status] ?? r.status),
    },
    { key: "checkIn", header: "In", render: (r) => r.checkIn ?? "—" },
    { key: "checkOut", header: "Out", render: (r) => r.checkOut ?? "—" },
    {
      key: "workedHours",
      header: "Hours",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.workedHours ?? "—"}</span>,
    },
  ];

  const payslipColumns: DataTableColumn<PayslipRow>[] = [
    { key: "periodLabel", header: "Period", render: (r) => r.periodLabel || "—" },
    {
      key: "gross",
      header: "Gross",
      align: "right",
      render: (r) => <span className="tabular-nums">{formatMoney(r.gross)}</span>,
    },
    {
      key: "deductions",
      header: "Deductions",
      align: "right",
      render: (r) => <span className="tabular-nums">{formatMoney(r.deductions)}</span>,
    },
    {
      key: "net",
      header: "Net pay",
      align: "right",
      render: (r) => <span className="font-medium tabular-nums">{formatMoney(r.net)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => toneBadge(r.status, PAYSLIP_STATUS_LABELS[r.status] ?? r.status),
    },
  ];

  if (!employee) {
    return (
      <SabHrmPageShell
        title="My space"
        description="Your personal HR home — profile, leave, attendance and payslips."
      >
        <Card className="p-10">
          <EmptyState
            icon={<UserRound aria-hidden />}
            title="No employee profile"
            description="You don't have an employee profile in this organization."
          />
        </Card>
      </SabHrmPageShell>
    );
  }

  const initials = (employee.firstName[0] ?? "") + (employee.lastName[0] ?? "");

  return (
    <SabHrmPageShell
      title="My space"
      description="Your personal HR home — profile, leave, attendance and payslips."
    >
      <div className="flex flex-col gap-6">
        {/* Profile card */}
        <Card className="p-5">
          <div className="flex flex-wrap items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--st-bg-muted)] text-base font-semibold text-[var(--st-text-secondary)]">
              {initials.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-[var(--st-text)]">
                  {employee.displayName}
                </h2>
                <Badge variant={TONE_BADGE[statusTone(employee.status)]}>
                  {EMPLOYEE_STATUS_LABELS[employee.status]}
                </Badge>
              </div>
              <p className="truncate text-sm text-[var(--st-text-secondary)]">{employee.email}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <ProfileField label="Employee code" value={employee.employeeCode} />
            <ProfileField label="Department" value={employee.departmentName ?? "—"} />
            <ProfileField label="Designation" value={employee.designationName ?? "—"} />
            <ProfileField label="Reporting manager" value={employee.reportingManagerName ?? "—"} />
            <ProfileField
              label="Employment type"
              value={EMPLOYMENT_TYPE_LABELS[employee.employmentType]}
            />
            <ProfileField label="Date of joining" value={employee.dateOfJoining ?? "—"} />
            <ProfileField label="Work location" value={employee.workLocation ?? "—"} />
            <ProfileField label="Phone" value={employee.phone ?? "—"} />
          </div>
        </Card>

        {/* My leave */}
        <SectionCard title="My leave" icon={<CalendarDays className="h-4 w-4" aria-hidden />}>
          {leaveRequests.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState
                icon={<CalendarDays aria-hidden />}
                title="No leave requests"
                description="You haven't applied for any leave yet."
              />
            </div>
          ) : (
            <DataTable columns={leaveColumns} rows={leaveRequests} getRowId={(r) => r.id} hover />
          )}
        </SectionCard>

        {/* My attendance (last 10) */}
        <SectionCard title="My attendance" icon={<Clock className="h-4 w-4" aria-hidden />}>
          {attendance.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState
                icon={<Clock aria-hidden />}
                title="No attendance records"
                description="Your recent attendance will appear here."
              />
            </div>
          ) : (
            <DataTable columns={attendanceColumns} rows={attendance} getRowId={(r) => r.id} hover />
          )}
        </SectionCard>

        {/* My payslips */}
        <SectionCard title="My payslips" icon={<Receipt className="h-4 w-4" aria-hidden />}>
          {payslips.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState
                icon={<Receipt aria-hidden />}
                title="No payslips"
                description="Your payslips will appear here once payroll is processed."
              />
            </div>
          ) : (
            <DataTable columns={payslipColumns} rows={payslips} getRowId={(r) => r.id} hover />
          )}
        </SectionCard>
      </div>
    </SabHrmPageShell>
  );
}
