'use client';

import React, { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  Badge,
  Button,
  EmptyState,
  StatCard,
} from '@/components/zoruui';
import {
  Users,
  CalendarHeart,
  Briefcase,
  Calendar,
  Clock,
  CheckCircle2,
  UserCheck,
  UserX,
  UserPlus,
  Activity,
  Building,
  Target,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { approveOrRejectLeave } from '@/app/actions/crm-hr.actions';
import { useToast } from '@/hooks/use-toast';

interface PendingLeave {
  _id: string;
  employeeId: string;
  employeeName: string;
  employeeImage: string | null;
  designation: string;
  leaveType: string;
  startDate: string | null;
  endDate: string | null;
  reason: string;
  status: string;
}

interface AttendanceRecord {
  _id: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  image: string | null;
  status: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
}

interface JobPosting {
  _id: string;
  title: string;
  department: string;
  status: string;
  location?: string;
}

interface Holiday {
  _id: string;
  name: string;
  date: string;
  holidayType?: string;
}

interface HrmAdminDashboardClientProps {
  activeEmployeesCount: number;
  totalEmployeesCount: number;
  todayAttendanceRate: number;
  pendingLeavesCount: number;
  activeJobsCount: number;
  pendingLeaves: PendingLeave[];
  todayAttendanceFeed: AttendanceRecord[];
  activeJobs: JobPosting[];
  upcomingHolidays: Holiday[];
  departmentsCount: number;
  goalsCount: number;
  userName: string;
}

type BadgeTone = 'neutral' | 'rose' | 'rose-soft' | 'obsidian' | 'green' | 'amber' | 'red' | 'blue';

function leaveTypeTone(type: string): BadgeTone {
  const t = type.toLowerCase();
  if (t.includes('sick') || t.includes('sl')) return 'red';
  if (t.includes('casual') || t.includes('cl')) return 'amber';
  if (t.includes('earned') || t.includes('el')) return 'blue';
  return 'neutral';
}

function attendanceTone(status: string): { tone: BadgeTone; label: string } {
  const s = status.toLowerCase();
  if (s === 'present') return { tone: 'green', label: 'Present' };
  if (s === 'wfh') return { tone: 'blue', label: 'WFH' };
  if (s === 'late') return { tone: 'amber', label: 'Late' };
  if (s === 'absent') return { tone: 'red', label: 'Absent' };
  return { tone: 'neutral', label: status };
}

function monogram(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

export function HrmAdminDashboardClient({
  activeEmployeesCount,
  totalEmployeesCount,
  todayAttendanceRate,
  pendingLeavesCount: _pendingLeavesCount,
  activeJobsCount,
  pendingLeaves: initialPendingLeaves,
  todayAttendanceFeed,
  activeJobs,
  upcomingHolidays,
  departmentsCount,
  goalsCount,
  userName,
}: HrmAdminDashboardClientProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [leavesList, setLeavesList] = useState<PendingLeave[]>(initialPendingLeaves);
  const reduce = useReducedMotion();

  const upcomingHolidayDays = useMemo(() => {
    const now = Date.now();
    const cutoff = now + 30 * 24 * 60 * 60 * 1000;
    return upcomingHolidays.filter((h) => {
      const t = new Date(h.date).getTime();
      return t >= now && t <= cutoff;
    }).length;
  }, [upcomingHolidays]);

  const handleLeaveAction = (id: string, action: 'Approved' | 'Rejected') => {
    startTransition(async () => {
      try {
        const res = await approveOrRejectLeave(id, action);
        if (res.success) {
          toast({
            title: `Request ${action.toLowerCase()}`,
            description: `The leave request has been ${action.toLowerCase()}.`,
          });
          setLeavesList((prev) => prev.filter((l) => l._id !== id));
        } else {
          toast({
            title: 'Action failed',
            description: res.error || 'Failed to update leave request.',
            variant: 'destructive',
          });
        }
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Unexpected error',
          variant: 'destructive',
        });
      }
    });
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
      <section
        aria-label="Welcome"
        className="rounded-2xl border border-zinc-200 bg-white px-5 py-4"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-2 w-2 rounded-full bg-rose-500" aria-hidden />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900">
                HRM operations, {userName || 'Administrator'}
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500">
                Approvals, attendance, hiring, and people health at a glance.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-8 rounded-full px-3 text-[12px] active:scale-[0.97]"
              asChild
            >
              <Link href="/dashboard/hrm/payroll/employees/new">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add employee
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full px-3 text-[12px] active:scale-[0.97]"
              asChild
            >
              <Link href="/dashboard/hrm/payroll">
                <Activity className="mr-1.5 h-3.5 w-3.5" /> Run payroll
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* KPI strip - 6 tiles */}
      <section aria-label="KPIs" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active staff" value={activeEmployeesCount.toLocaleString()} icon={<Users />} period={`${totalEmployeesCount} total`} />
        <StatCard label="Headcount" value={totalEmployeesCount.toLocaleString()} icon={<UserCheck />} />
        <StatCard label="Attendance today" value={`${todayAttendanceRate}%`} icon={<Clock />} period="of active staff" />
        <StatCard label="Pending leaves" value={leavesList.length.toLocaleString()} icon={<CalendarHeart />} period={leavesList.length > 0 ? 'needs action' : 'all clear'} />
        <StatCard label="Active jobs" value={activeJobsCount.toLocaleString()} icon={<Briefcase />} period={`${activeJobs.length} total`} />
        <StatCard label="Holidays in 30d" value={upcomingHolidayDays.toLocaleString()} icon={<Calendar />} period="upcoming" />
      </section>

      {/* Three-column main grid */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Pending leaves */}
        <div className="rounded-2xl border border-zinc-200 bg-white">
          <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <CalendarHeart className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Pending leaves</h2>
            </div>
            <Badge tone={leavesList.length > 0 ? 'amber' : 'neutral'} className="rounded-full px-2 py-0 text-[10px] font-mono">
              {leavesList.length}
            </Badge>
          </header>
          <div className="p-3">
            {leavesList.length === 0 ? (
              <EmptyState
                compact
                icon={<CheckCircle2 />}
                title="Inbox zero on leaves"
                description="No pending requests right now."
              />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {leavesList.map((leave, i) => (
                  <motion.li
                    key={leave._id}
                    custom={i}
                    initial={reduce ? undefined : 'hidden'}
                    animate={reduce ? undefined : 'show'}
                    variants={rowVariants}
                    className="flex flex-col gap-2 py-2.5"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
                        {monogram(leave.employeeName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[13px] font-semibold text-zinc-900">
                            {leave.employeeName}
                          </p>
                          <Badge
                            tone={leaveTypeTone(leave.leaveType)}
                            className="rounded-full px-1.5 py-0 text-[10px] uppercase tracking-wide"
                          >
                            {leave.leaveType}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-zinc-500">{leave.designation || 'Team member'}</p>
                        <p className="mt-1 text-[11px] text-zinc-600">
                          {leave.startDate
                            ? new Date(leave.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })
                            : '-'}{' '}
                          to{' '}
                          {leave.endDate
                            ? new Date(leave.endDate).toLocaleDateString([], { month: 'short', day: 'numeric' })
                            : '-'}
                        </p>
                        {leave.reason && (
                          <p className="mt-1 line-clamp-2 rounded-md bg-zinc-50 px-2 py-1 text-[11px] italic text-zinc-600">
                            {leave.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5 pl-10">
                      <Button
                        size="sm"
                        onClick={() => handleLeaveAction(leave._id, 'Approved')}
                        disabled={isPending}
                        className="h-7 rounded-full px-2.5 text-[11px] active:scale-[0.97]"
                      >
                        <UserCheck className="mr-1 h-3 w-3" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLeaveAction(leave._id, 'Rejected')}
                        disabled={isPending}
                        className="h-7 rounded-full px-2.5 text-[11px] active:scale-[0.97]"
                      >
                        <UserX className="mr-1 h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Today attendance feed */}
        <div className="rounded-2xl border border-zinc-200 bg-white">
          <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Today&apos;s attendance</h2>
            </div>
            <Link
              href="/dashboard/hrm/payroll/attendance"
              className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            >
              Register <ChevronRight className="h-3 w-3" />
            </Link>
          </header>
          {todayAttendanceFeed.length === 0 ? (
            <div className="p-3">
              <EmptyState
                compact
                icon={<Inbox />}
                title="No clock-ins yet"
                description="Punches will appear here as your team starts the day."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {todayAttendanceFeed.map((r, i) => {
                const { tone, label } = attendanceTone(r.status);
                return (
                  <motion.li
                    key={r._id || `${r.employeeId}-${i}`}
                    custom={i}
                    initial={reduce ? undefined : 'hidden'}
                    animate={reduce ? undefined : 'show'}
                    variants={rowVariants}
                    className="flex items-center gap-2.5 px-4 py-2"
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
                      {monogram(r.employeeName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-zinc-900">{r.employeeName}</p>
                      <p className="truncate text-[11px] text-zinc-500">{r.designation}</p>
                    </div>
                    <div className="hidden text-right text-[11px] sm:block">
                      <p className="font-mono text-zinc-900">
                        {r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </p>
                      <p className="font-mono text-zinc-400">
                        {r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </p>
                    </div>
                    <Badge tone={tone} className="ml-2 rounded-full px-2 py-0 text-[10px] capitalize">
                      {label}
                    </Badge>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Active jobs + side rail */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Active jobs</h2>
              </div>
              <Link
                href="/dashboard/hrm/hr/jobs"
                className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </header>
            {activeJobs.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  compact
                  icon={<Briefcase />}
                  title="No openings"
                  description="Create a job posting to start hiring."
                  action={
                    <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-[12px] active:scale-[0.97]" asChild>
                      <Link href="/dashboard/hrm/hr/jobs/new">New posting</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {activeJobs.slice(0, 5).map((job) => {
                  const open = job.status?.toLowerCase() === 'open';
                  return (
                    <li key={job._id} className="flex items-center gap-2.5 px-4 py-2.5">
                      <span
                        aria-hidden
                        className={`inline-flex h-1.5 w-1.5 rounded-full ${open ? 'bg-emerald-500' : 'bg-zinc-300'}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-zinc-900">{job.title}</p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                          <Building className="h-3 w-3" /> {job.department || 'General'}
                          {job.location && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="truncate">{job.location}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge tone={open ? 'green' : 'neutral'} className="rounded-full px-1.5 py-0 text-[10px] capitalize">
                        {job.status || 'open'}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/dashboard/hrm/payroll/departments"
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-zinc-300 active:scale-[0.97]"
            >
              <div className="flex items-center gap-2 text-zinc-500">
                <Building className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Departments</span>
              </div>
              <p className="mt-1 font-mono text-xl font-semibold text-zinc-900">
                {departmentsCount.toLocaleString()}
              </p>
            </Link>
            <Link
              href="/dashboard/hrm/payroll/goals"
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-zinc-300 active:scale-[0.97]"
            >
              <div className="flex items-center gap-2 text-zinc-500">
                <Target className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Goals</span>
              </div>
              <p className="mt-1 font-mono text-xl font-semibold text-zinc-900">
                {goalsCount.toLocaleString()}
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Holiday strip */}
      <section
        aria-label="Upcoming holidays"
        className="rounded-2xl border border-zinc-200 bg-white px-4 py-3"
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Upcoming holidays</h2>
          </div>
          <Link
            href="/dashboard/hrm/payroll/holidays"
            className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
          >
            Calendar <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {upcomingHolidays.length === 0 ? (
          <EmptyState
            compact
            icon={<Calendar />}
            title="No upcoming holidays"
            description="Add company holidays to populate this strip."
          />
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {upcomingHolidays.map((h) => {
              const d = new Date(h.date);
              return (
                <div
                  key={h._id}
                  className="flex shrink-0 items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2"
                >
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-zinc-50 ring-1 ring-zinc-200">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
                      {d.toLocaleString([], { month: 'short' })}
                    </span>
                    <span className="font-mono text-sm font-semibold text-zinc-900 leading-none">
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
      </section>
    </div>
  );
}
