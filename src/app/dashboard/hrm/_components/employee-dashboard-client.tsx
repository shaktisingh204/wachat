'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { m, useReducedMotion } from 'motion/react';
import { Badge, Button, EmptyState, StatCard } from '@/components/sabcrm/20ui';
import {
  Briefcase,
  CheckSquare,
  CalendarDays,
  Activity,
  CalendarHeart,
  Clock,
  Plus,
  ArrowRight,
  UserCheck,
  Inbox,
  ListChecks,
} from 'lucide-react';
import { EmployeePunchWidget } from './employee-punch-widget';

interface EmployeeDashboardClientProps {
  employee: any;
  attendance: any | null;
  attendance30d: any[];
  tasks: any[];
  projects: any[];
  recentLeaves: any[];
  upcomingHolidays: any[];
}

type BadgeTone = 'neutral' | 'rose' | 'rose-soft' | 'obsidian' | 'green' | 'amber' | 'red' | 'blue';

function priorityTone(p?: string): BadgeTone {
  const v = (p || '').toLowerCase();
  if (v === 'high' || v === 'urgent') return 'red';
  if (v === 'medium') return 'amber';
  if (v === 'low') return 'blue';
  return 'neutral';
}

function leaveStatusTone(s?: string): BadgeTone {
  const v = (s || '').toLowerCase();
  if (v === 'approved') return 'green';
  if (v === 'pending') return 'amber';
  if (v === 'rejected') return 'red';
  return 'neutral';
}

function monogram(name?: string) {
  if (!name) return 'E';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

export function EmployeeDashboardClient({
  employee,
  attendance,
  attendance30d,
  tasks,
  projects,
  recentLeaves,
  upcomingHolidays,
}: EmployeeDashboardClientProps) {
  const reduce = useReducedMotion();

  const presentCount = useMemo(
    () => attendance30d.filter((a) => a.status === 'present' || a.status === 'wfh').length,
    [attendance30d]
  );
  const totalHours = useMemo(
    () => attendance30d.reduce((sum, a) => sum + (a.totalHours ?? 0), 0),
    [attendance30d]
  );
  const avgHours = presentCount > 0 ? (totalHours / presentCount).toFixed(1) : '0';
  const monthAttendancePct = attendance30d.length > 0
    ? Math.round((presentCount / attendance30d.length) * 100)
    : 0;

  const pendingTasks = useMemo(
    () => tasks.filter((t) => (t.status || '').toLowerCase() !== 'done').length,
    [tasks]
  );

  const usedLeavesDays = useMemo(
    () =>
      recentLeaves
        .filter((l) => (l.status || '').toLowerCase() === 'approved')
        .reduce((sum, l) => sum + (l.days ?? 0), 0),
    [recentLeaves]
  );

  const todayStatusLabel = useMemo(() => {
    if (!attendance) return 'Not started';
    if (attendance.punchOut?.at) return 'Completed';
    if (attendance.punchIn?.at) return 'On shift';
    return 'Not started';
  }, [attendance]);

  // Last 7-day attendance timeline
  const last7 = useMemo(() => {
    const days: Array<{ date: string; status: string }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const rec = attendance30d.find((a) => a.date && a.date.startsWith(iso));
      days.push({ date: iso, status: rec?.status || 'absent' });
    }
    return days;
  }, [attendance30d]);

  const dayDot = (s: string) => {
    const v = s.toLowerCase();
    if (v === 'present') return 'bg-emerald-500';
    if (v === 'wfh') return 'bg-sky-500';
    if (v === 'late') return 'bg-amber-500';
    if (v === 'leave') return 'bg-violet-500';
    return 'bg-zinc-200';
  };

  const rowVariants = reduce
    ? undefined
    : {
        hidden: { opacity: 0, y: 6 },
        show: (i: number) => ({
          opacity: 1,
          y: 0,
          transition: { delay: i * 0.035, duration: 0.28, ease: [0.22, 1, 0.36, 1] },
        }),
      };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-6 pb-12">
      {/* Hero ribbon */}
      <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[12px] font-semibold text-white">
              {monogram(employee.firstName)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900">
                Welcome back, {employee.firstName || 'Team Member'}
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                {employee.designation || 'Team Member'}
                {employee.departmentName && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{employee.departmentName}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <Badge
            tone={todayStatusLabel === 'On shift' ? 'green' : todayStatusLabel === 'Completed' ? 'blue' : 'neutral'}
            className="self-start rounded-full px-2.5 py-0.5 text-[11px] font-medium md:self-center"
          >
            {todayStatusLabel}
          </Badge>
        </div>
      </section>

      {/* Punch widget - only for non-admin employees */}
      {!employee.isAdmin && (
        <EmployeePunchWidget employeeId={String(employee._id)} initialAttendance={attendance} />
      )}

      {/* KPI strip - 6 tiles */}
      <section aria-label="KPIs" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Attendance 30d" value={`${monthAttendancePct}%`} icon={<Activity />} period={`${presentCount} days present`} />
        <StatCard label="Pending tasks" value={pendingTasks.toLocaleString()} icon={<ListChecks />} period={`${tasks.length} assigned`} />
        <StatCard label="Active projects" value={projects.length.toLocaleString()} icon={<Briefcase />} />
        <StatCard label="Used leaves" value={usedLeavesDays.toLocaleString()} icon={<CalendarHeart />} period="approved this period" />
        <StatCard label="Avg hours" value={avgHours} icon={<Clock />} period="per workday" />
        <StatCard label="Holidays upcoming" value={upcomingHolidays.length.toLocaleString()} icon={<CalendarDays />} />
      </section>

      {/* Main 3-col grid: tasks (2x) + side rail */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white lg:col-span-2">
          <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900">My tasks</h2>
            </div>
            <Link
              href="/dashboard/crm/tasks"
              className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          {tasks.length === 0 ? (
            <div className="p-3">
              <EmptyState
                compact
                icon={<Inbox />}
                title="No active tasks"
                description="When you are assigned tasks they will show here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {tasks.slice(0, 6).map((t, i) => (
                <m.li
                  key={String(t._id)}
                  custom={i}
                  initial={reduce ? undefined : 'hidden'}
                  animate={reduce ? undefined : 'show'}
                  variants={rowVariants}
                >
                  <Link
                    href={`/dashboard/crm/tasks/${t._id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50/60"
                  >
                    <span aria-hidden className="inline-flex h-1.5 w-1.5 rounded-full bg-zinc-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-zinc-900">{t.title}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                        <Clock className="h-3 w-3" />
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No date'}
                        <span aria-hidden>·</span>
                        <span className="capitalize">{t.status || 'to-do'}</span>
                      </div>
                    </div>
                    <Badge tone={priorityTone(t.priority)} className="rounded-full px-1.5 py-0 text-[10px] capitalize">
                      {t.priority || 'normal'}
                    </Badge>
                  </Link>
                </m.li>
              ))}
            </ul>
          )}
        </div>

        {/* Side rail: projects + leaves */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-semibold tracking-tight text-zinc-900">My projects</h2>
              </div>
              <Badge tone="neutral" className="rounded-full px-2 py-0 text-[10px] font-mono">
                {projects.length}
              </Badge>
            </header>
            {projects.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  compact
                  icon={<Briefcase />}
                  title="No projects"
                  description="You have not been assigned to a project yet."
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {projects.slice(0, 4).map((p) => (
                  <li key={String(p._id)}>
                    <Link
                      href={`/dashboard/crm/projects/${p._id}`}
                      className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-zinc-50/60"
                    >
                      <span aria-hidden className="inline-flex h-1.5 w-1.5 rounded-full bg-violet-500" />
                      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-900">{p.name}</p>
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white">
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <CalendarHeart className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Recent leaves</h2>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 rounded-full px-2.5 text-[11px] active:scale-[0.97]"
                asChild
              >
                <Link href="/dashboard/crm/hr-payroll/leave/new">
                  <Plus className="mr-1 h-3 w-3" /> Request
                </Link>
              </Button>
            </header>
            {recentLeaves.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  compact
                  icon={<CalendarHeart />}
                  title="No leaves"
                  description="Time-off requests appear here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {recentLeaves.slice(0, 4).map((l) => (
                  <li key={String(l._id)} className="flex items-center gap-2.5 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-zinc-900">
                        {l.leaveTypeId || 'Leave'} <span className="text-zinc-400">·</span> {l.days ?? 0}d
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {l.startDate ? new Date(l.startDate).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <Badge tone={leaveStatusTone(l.status)} className="rounded-full px-1.5 py-0 text-[10px] capitalize">
                      {l.status || 'pending'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Bottom row: 7-day timeline + holidays strip */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Last 7 days</h2>
            <span className="text-[11px] text-zinc-500">attendance</span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-1.5">
            {last7.map((d) => {
              const day = new Date(d.date);
              return (
                <div key={d.date} className="flex flex-col items-center gap-1.5">
                  <span aria-hidden className={`h-8 w-2 rounded-full ${dayDot(d.status)}`} />
                  <span className="text-[10px] font-medium text-zinc-500">
                    {day.toLocaleDateString([], { weekday: 'short' })[0]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-500">
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Present</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> WFH</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Late</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-zinc-200" /> Absent</span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Upcoming holidays</h2>
            </div>
          </div>
          {upcomingHolidays.length === 0 ? (
            <EmptyState
              compact
              icon={<CalendarDays />}
              title="No upcoming holidays"
              description="Public holidays will appear here."
            />
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {upcomingHolidays.map((h) => {
                const d = new Date(h.date);
                return (
                  <div
                    key={String(h._id)}
                    className="flex shrink-0 items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2"
                  >
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-zinc-50 ring-1 ring-zinc-200">
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
                        {d.toLocaleString([], { month: 'short' })}
                      </span>
                      <span className="font-mono text-sm font-semibold leading-none text-zinc-900">
                        {d.getDate()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-zinc-900">{h.name}</p>
                      <p className="truncate text-[11px] capitalize text-zinc-500">
                        {h.holidayType || 'holiday'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
