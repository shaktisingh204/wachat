import Link from "next/link";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  Users,
  Wallet,
} from "lucide-react";

import { Badge, Button, Card, EmptyState } from "@/components/sabcrm/20ui";
import { SabHrmPageShell, StatCard, formatMoney, statusTone } from "@/components/sabhrm/page-toolkit";
import {
  getSabHrmAnalytics,
  type NamedCount,
} from "@/app/actions/sabhrm/analytics.actions";

export const dynamic = "force-dynamic";

const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

const PAYROLL_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  computed: "Computed",
  approved: "Approved",
  paid: "Paid",
};

/** A horizontal bar-list card, mirroring the dashboard "headcount by department". */
function BarListCard({
  title,
  items,
  emptyLabel,
  manageHref,
  manageLabel,
}: {
  title: string;
  items: NamedCount[];
  emptyLabel: string;
  manageHref?: string;
  manageLabel?: string;
}) {
  const max = Math.max(...items.map((x) => x.count), 1);
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--st-text)]">{title}</h2>
        {manageHref ? (
          <Link href={manageHref} className="text-xs text-[var(--st-text-secondary)] underline">
            {manageLabel ?? "Manage"}
          </Link>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--st-text-secondary)]">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((d) => {
            const pct = Math.round((d.count / max) * 100);
            return (
              <li key={d.name} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm text-[var(--st-text)]">{d.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--st-bg-muted)]">
                  <span
                    className="block h-full rounded-full bg-[var(--st-primary,var(--st-accent,#6366f1))]"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-sm tabular-nums text-[var(--st-text-secondary)]">
                  {d.count}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default async function SabHrmAnalyticsPage() {
  const res = await getSabHrmAnalytics();
  const data = res.ok ? res.data : null;

  return (
    <SabHrmPageShell
      title="HR analytics"
      description="Workforce insights — headcount mix, attendance, leave, and payroll trends."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/sabhrm/employees">
            <Users className="h-4 w-4" aria-hidden /> Employees
          </Link>
        </Button>
      }
    >
      {!data ? (
        <Card className="p-10">
          <EmptyState
            icon={<BarChart3 aria-hidden />}
            title="Analytics unavailable"
            description={res.ok ? "No data yet." : res.error}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Headcount"
              value={data.headcount}
              icon={Users}
              hint={`${data.activeCount} active`}
            />
            <StatCard
              label="Departments"
              value={data.departmentCount}
              icon={Building2}
            />
            <StatCard
              label="Attendance rate"
              value={`${data.attendance.rate}%`}
              icon={CalendarCheck}
              tone={
                data.attendance.totalRecords === 0
                  ? "default"
                  : data.attendance.rate >= 90
                    ? "positive"
                    : data.attendance.rate >= 75
                      ? "warning"
                      : "danger"
              }
              hint={`last ${data.attendance.windowDays} days`}
            />
            <StatCard
              label="Latest payroll (net)"
              value={formatMoney(data.latestPayroll.netTotal)}
              icon={Wallet}
              hint={
                data.latestPayroll.status
                  ? `${data.latestPayroll.label ?? "Run"} · ${PAYROLL_STATUS_LABEL[data.latestPayroll.status] ?? data.latestPayroll.status}`
                  : "No payroll yet"
              }
            />
          </div>

          {/* Bar lists */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BarListCard
              title="Headcount by department"
              items={data.headcountByDepartment}
              emptyLabel="No departments yet."
              manageHref="/sabhrm/departments"
            />
            <BarListCard
              title="Headcount by employment type"
              items={data.headcountByEmploymentType}
              emptyLabel="No employees yet."
            />
            <BarListCard
              title="Headcount by status"
              items={data.headcountByStatus}
              emptyLabel="No employees yet."
            />
            <BarListCard
              title="Gender split"
              items={data.genderSplit}
              emptyLabel="No gender data recorded."
            />
          </div>

          {/* Leave breakdown */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--st-text)]">Leave requests by status</h2>
              <Link href="/sabhrm/leave" className="text-xs text-[var(--st-text-secondary)] underline">
                Review leave
              </Link>
            </div>
            {data.leaveRequestsByStatus.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--st-text-secondary)]">
                No leave requests yet.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2.5">
                {data.leaveRequestsByStatus.map((l) => {
                  const key = l.name.toLowerCase().replace(/\s+/g, "_");
                  return (
                    <li key={l.name}>
                      <Badge variant={TONE_BADGE[statusTone(key)]}>
                        {l.name}: {l.count}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
            {data.pendingLeaveApprovals > 0 ? (
              <p className="mt-3 text-xs text-[var(--st-text-secondary)]">
                {data.pendingLeaveApprovals} request{data.pendingLeaveApprovals === 1 ? "" : "s"} awaiting approval.
              </p>
            ) : null}
          </Card>
        </div>
      )}
    </SabHrmPageShell>
  );
}
