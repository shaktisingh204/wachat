import Link from "next/link";
import {
  CalendarOff,
  CheckCircle2,
  ClipboardList,
  Gift,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { Badge, Button, Card, EmptyState } from "@/components/sabcrm/20ui";
import { SabHrmPageShell, StatCard } from "@/components/sabhrm/page-toolkit";
import { getSabHrmDashboard } from "@/app/actions/sabhrm/dashboard.actions";

export const dynamic = "force-dynamic";

const PAYROLL_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  computed: "Computed",
  approved: "Approved",
  paid: "Paid",
};

function fmtMonthDay(md: string): string {
  // md is either MM-DD or YYYY-MM-DD
  const parts = md.split("-");
  const [m, d] = parts.length === 3 ? [parts[1], parts[2]] : [parts[0], parts[1]];
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m)] ?? ""} ${Number(d)}`;
}

export default async function SabHrmDashboardPage() {
  const res = await getSabHrmDashboard();
  const data = res.ok ? res.data : null;

  return (
    <SabHrmPageShell
      title="HR dashboard"
      description="Your people at a glance — headcount, attendance, approvals, and payroll."
      actions={
        <Button asChild variant="primary" size="sm">
          <Link href="/sabhrm/employees">
            <UserPlus className="h-4 w-4" aria-hidden /> Add employee
          </Link>
        </Button>
      }
    >
      {!data ? (
        <Card className="p-10">
          <EmptyState
            icon={<Users aria-hidden />}
            title="Dashboard unavailable"
            description={res.ok ? "No data yet." : res.error}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Headcount" value={data.headcount} icon={Users} hint={`${data.activeCount} active`} />
            <StatCard label="Present today" value={data.presentToday} icon={CheckCircle2} tone="positive" />
            <StatCard label="On leave today" value={data.onLeaveToday} icon={CalendarOff} tone="warning" />
            <StatCard
              label="Pending approvals"
              value={data.pendingLeaveApprovals}
              icon={ClipboardList}
              tone={data.pendingLeaveApprovals > 0 ? "warning" : "default"}
              hint={<Link className="underline" href="/sabhrm/leave">Review leave</Link>}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Headcount by department */}
            <Card className="p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--st-text)]">Headcount by department</h2>
                <Link href="/sabhrm/departments" className="text-xs text-[var(--st-text-secondary)] underline">
                  Manage
                </Link>
              </div>
              {data.headcountByDepartment.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--st-text-secondary)]">
                  No departments yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {data.headcountByDepartment.map((d) => {
                    const max = Math.max(...data.headcountByDepartment.map((x) => x.count), 1);
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

            {/* Payroll + upcoming */}
            <div className="flex flex-col gap-6">
              <Card className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden />
                  <h2 className="text-sm font-semibold text-[var(--st-text)]">Latest payroll</h2>
                </div>
                {data.latestPayrollStatus ? (
                  <Badge variant="outline">{PAYROLL_STATUS_LABEL[data.latestPayrollStatus]}</Badge>
                ) : (
                  <p className="text-sm text-[var(--st-text-secondary)]">No payroll runs yet.</p>
                )}
                <div className="mt-3">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/sabhrm/payroll-runs">Open payroll</Link>
                  </Button>
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Gift className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden />
                  <h2 className="text-sm font-semibold text-[var(--st-text)]">Upcoming</h2>
                </div>
                {data.upcoming.length === 0 ? (
                  <p className="text-sm text-[var(--st-text-secondary)]">Nothing in the next 30 days.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.upcoming.map((u, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-[var(--st-text)]">{u.label}</span>
                        <span className="shrink-0 text-xs text-[var(--st-text-secondary)]">
                          {fmtMonthDay(u.date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          {/* Recent joiners */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--st-text)]">Recent joiners</h2>
              <Link href="/sabhrm/employees" className="text-xs text-[var(--st-text-secondary)] underline">
                All employees
              </Link>
            </div>
            {data.recentJoiners.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--st-text-secondary)]">No employees yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--st-border)]">
                {data.recentJoiners.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link
                      href={`/sabhrm/employees/${j.id}`}
                      className="truncate text-sm font-medium text-[var(--st-text)] hover:underline"
                    >
                      {j.name}
                    </Link>
                    <span className="shrink-0 text-xs text-[var(--st-text-secondary)]">
                      {j.designation ? `${j.designation} · ` : ""}
                      {j.date}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </SabHrmPageShell>
  );
}
