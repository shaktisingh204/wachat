'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { m, useReducedMotion } from 'motion/react';
import { fmtDate } from '@/lib/utils';
import { Badge, Button, EmptyState, StatCard } from '@/components/sabcrm/20ui';
import {
  Users,
  Briefcase,
  UserPlus,
  Megaphone,
  FileText,
  Plus,
  Calendar,
  Bell,
  Heart,
  ShieldCheck,
  ChevronRight,
  Inbox,
  Award,
  Gavel,
  ClipboardList,
  GraduationCap,
} from 'lucide-react';

interface OnboardingKpis {
  total: number;
  inProgress: number;
  completedThisMonth: number;
  avgCompletionDays: number;
}

interface CrmOnboardingTask {
  id: string;
  title: string;
  status: string;
}

interface CrmOnboardingDoc {
  _id: string;
  employeeName?: string;
  joiningDate?: string;
  status: string;
  progress?: number;
  checklist?: CrmOnboardingTask[];
}

interface CrmJobDoc {
  _id: string;
  title: string;
  departmentName?: string;
  employmentType: string;
  openings: number;
  filled: number;
  status: string;
  location?: string;
}

interface CrmAnnouncementDoc {
  _id: string;
  title: string;
  body: string;
  category?: string;
  priority: string;
  audience?: string;
  authorName?: string;
  status: string;
  publishedAt?: string;
  createdAt?: string;
}

interface CrmPolicyDoc {
  _id: string;
  name: string;
  version?: string;
  category?: string;
  effectiveDate?: string;
  status: string;
}

interface HrOverviewClientProps {
  onboardingKpis: OnboardingKpis;
  activeOnboardings: CrmOnboardingDoc[];
  jobs: CrmJobDoc[];
  announcements: CrmAnnouncementDoc[];
  policies: CrmPolicyDoc[];
  activeEmployeesCount: number;
  totalEmployeesCount: number;
  userName: string;
}

type BadgeTone = 'neutral' | 'rose' | 'rose-soft' | 'obsidian' | 'green' | 'amber' | 'red' | 'blue';

function priorityTone(p?: string): BadgeTone {
  const v = (p || '').toLowerCase();
  if (v === 'urgent') return 'red';
  if (v === 'high') return 'amber';
  if (v === 'normal') return 'blue';
  return 'neutral';
}

function jobTone(status?: string): BadgeTone {
  const v = (status || '').toLowerCase();
  if (v === 'open') return 'green';
  if (v === 'draft') return 'neutral';
  if (v === 'on_hold') return 'amber';
  if (v === 'filled') return 'blue';
  return 'neutral';
}

function onboardingTone(status?: string): BadgeTone {
  const v = (status || '').toLowerCase();
  if (v === 'completed') return 'green';
  if (v === 'in_progress') return 'blue';
  if (v === 'pending') return 'amber';
  return 'neutral';
}

function monogram(name?: string) {
  if (!name) return 'NH';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

function daysSince(iso?: string) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86400000));
}

const QUICK_ACTIONS = [
  { name: 'Employees', href: '/dashboard/hrm/payroll/employees', icon: Users, dot: 'bg-violet-500' },
  { name: 'Announcements', href: '/dashboard/hrm/hr/announcements/new', icon: Megaphone, dot: 'bg-sky-500' },
  { name: 'New job', href: '/dashboard/hrm/hr/jobs/new', icon: Briefcase, dot: 'bg-emerald-500' },
  { name: 'New policy', href: '/dashboard/hrm/hr/policies/new', icon: FileText, dot: 'bg-amber-500' },
  { name: 'Disciplinary', href: '/dashboard/hrm/hr/disciplinary', icon: Gavel, dot: 'bg-rose-500' },
  { name: 'Recognition', href: '/dashboard/hrm/hr/recognition', icon: Award, dot: 'bg-fuchsia-500' },
  { name: 'Doc templates', href: '/dashboard/hrm/hr/document-templates', icon: ClipboardList, dot: 'bg-indigo-500' },
  { name: 'Training', href: '/dashboard/hrm/hr/training', icon: GraduationCap, dot: 'bg-cyan-500' },
];

export function HrOverviewClient({
  onboardingKpis,
  activeOnboardings,
  jobs,
  announcements,
  policies,
  activeEmployeesCount,
  totalEmployeesCount,
  userName,
}: HrOverviewClientProps) {
  const reduce = useReducedMotion();

  const openJobs = useMemo(
    () => jobs.filter((j) => (j.status || '').toLowerCase() === 'open').length,
    [jobs]
  );

  const recentAnnouncementsCount = announcements.length;
  const pinnedPolicies = policies.length;

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
            <span aria-hidden className="inline-flex h-2 w-2 rounded-full bg-rose-500" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900">
                HR operations, {userName || 'Manager'}
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500">
                Hiring pipelines, onboardings, announcements, and policies in one place.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-8 rounded-full px-3 text-[12px] active:scale-[0.97]" asChild>
              <Link href="/dashboard/hrm/hr/jobs/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Post a job
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full px-3 text-[12px] active:scale-[0.97]"
              asChild
            >
              <Link href="/dashboard/hrm/hr/onboarding/new">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Onboard hire
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full px-3 text-[12px] active:scale-[0.97]"
              asChild
            >
              <Link href="/dashboard/hrm/hr/announcements/new">
                <Megaphone className="mr-1.5 h-3.5 w-3.5" /> Publish notice
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* KPI strip - 6 tiles */}
      <section aria-label="KPIs" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active staff" value={activeEmployeesCount.toLocaleString()} icon={<Users />} period={`${totalEmployeesCount} total`} />
        <StatCard label="Headcount" value={totalEmployeesCount.toLocaleString()} icon={<Users />} />
        <StatCard label="Open jobs" value={openJobs.toLocaleString()} icon={<Briefcase />} period={`${jobs.length} total`} />
        <StatCard label="Onboardings" value={onboardingKpis.inProgress.toLocaleString()} icon={<UserPlus />} period={`+${onboardingKpis.completedThisMonth} done this month`} />
        <StatCard label="Announcements" value={recentAnnouncementsCount.toLocaleString()} icon={<Megaphone />} period="recent" />
        <StatCard label="Policies" value={pinnedPolicies.toLocaleString()} icon={<ShieldCheck />} period="pinned" />
      </section>

      {/* 4-section layout: onboardings + jobs (left 2/3), announcements + policies (right 1/3) */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Left double column */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          {/* Active onboardings */}
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-zinc-500" />
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Active onboardings</h2>
                  <p className="mt-0.5 text-[11px] text-zinc-500">Tracking progress for new hires</p>
                </div>
              </div>
              <Link
                href="/dashboard/hrm/hr/onboarding"
                className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              >
                View list <ChevronRight className="h-3 w-3" />
              </Link>
            </header>
            {activeOnboardings.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  compact
                  icon={<Heart />}
                  title="No onboardings in flight"
                  description="Start an onboarding workspace from offer to day one."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full px-3 text-[12px] active:scale-[0.97]"
                      asChild
                    >
                      <Link href="/dashboard/hrm/hr/onboarding/new">New onboarding</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {activeOnboardings.slice(0, 5).map((o, i) => {
                  const progress = Math.max(0, Math.min(100, o.progress ?? 0));
                  const started = daysSince(o.joiningDate);
                  return (
                    <m.li
                      key={o._id}
                      custom={i}
                      initial={reduce ? undefined : 'hidden'}
                      animate={reduce ? undefined : 'show'}
                      variants={rowVariants}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
                        {monogram(o.employeeName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[13px] font-semibold text-zinc-900">
                            {o.employeeName || 'New hire'}
                          </p>
                          <Badge
                            tone={onboardingTone(o.status)}
                            className="rounded-full px-1.5 py-0 text-[10px] capitalize"
                          >
                            {o.status?.replace('_', ' ') || 'pending'}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          {o.joiningDate ? `Joined ${fmtDate(o.joiningDate)}` : 'No joining date'}
                          {started !== null && (
                            <>
                              <span aria-hidden> · </span>
                              <span>{started}d ago</span>
                            </>
                          )}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-transform"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-zinc-500">{progress}%</span>
                        </div>
                      </div>
                    </m.li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Open jobs grid */}
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-zinc-500" />
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Open positions</h2>
                  <p className="mt-0.5 text-[11px] text-zinc-500">Live on careers and recruitment channels</p>
                </div>
              </div>
              <Link
                href="/dashboard/hrm/hr/jobs"
                className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              >
                All jobs <ChevronRight className="h-3 w-3" />
              </Link>
            </header>
            {jobs.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  compact
                  icon={<Briefcase />}
                  title="No active jobs"
                  description="Create a posting to start receiving applications."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full px-3 text-[12px] active:scale-[0.97]"
                      asChild
                    >
                      <Link href="/dashboard/hrm/hr/jobs/new">New posting</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
                {jobs.slice(0, 6).map((job) => (
                  <Link
                    key={job._id}
                    href={`/dashboard/hrm/hr/jobs`}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 transition-colors hover:border-zinc-300 active:scale-[0.97]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold text-zinc-900">{job.title}</p>
                      <Badge tone={jobTone(job.status)} className="rounded-full px-1.5 py-0 text-[10px] capitalize">
                        {(job.status || 'open').replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                      {job.departmentName || 'General'}
                      {job.location && (
                        <>
                          <span aria-hidden> · </span>
                          <span>{job.location}</span>
                        </>
                      )}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-zinc-900">
                        {job.filled}<span className="text-zinc-400"> / {job.openings}</span>
                      </span>
                      <span className="capitalize text-zinc-500">
                        {(job.employmentType || 'full_time').replace('_', ' ')}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right single column */}
        <div className="flex flex-col gap-3">
          {/* Announcements feed */}
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Announcements</h2>
              </div>
              <Link
                href="/dashboard/hrm/hr/announcements"
                className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              >
                Feed <ChevronRight className="h-3 w-3" />
              </Link>
            </header>
            {announcements.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  compact
                  icon={<Bell />}
                  title="No announcements"
                  description="Publish a notice to the team."
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {announcements.slice(0, 4).map((a, i) => (
                  <m.li
                    key={a._id}
                    custom={i}
                    initial={reduce ? undefined : 'hidden'}
                    animate={reduce ? undefined : 'show'}
                    variants={rowVariants}
                    className="px-4 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Badge tone={priorityTone(a.priority)} className="rounded-full px-1.5 py-0 text-[10px] uppercase tracking-wide">
                        {a.priority}
                      </Badge>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {a.publishedAt ? fmtDate(a.publishedAt) : a.createdAt ? fmtDate(a.createdAt) : ''}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[13px] font-semibold text-zinc-900">
                      {a.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                      {a.body?.replace(/<[^>]*>/g, '') || ''}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-500">
                      <span>Aud: {a.audience || 'all'}</span>
                      <span>By {a.authorName || 'Ops'}</span>
                    </div>
                  </m.li>
                ))}
              </ul>
            )}
          </div>

          {/* Policies */}
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Policies</h2>
              </div>
              <Link
                href="/dashboard/hrm/hr/policies"
                className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </header>
            {policies.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  compact
                  icon={<Inbox />}
                  title="No policies"
                  description="Publish your first policy document."
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {policies.slice(0, 5).map((p) => (
                  <li key={p._id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-zinc-900">{p.name}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {p.effectiveDate ? `Updated ${fmtDate(p.effectiveDate)}` : `v${p.version || '1.0'}`}
                      </p>
                    </div>
                    <Badge tone="neutral" className="rounded-full px-1.5 py-0 text-[10px] capitalize">
                      {p.category || 'HR'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Quick-action grid */}
      <section
        aria-label="Quick actions"
        className="rounded-2xl border border-zinc-200 bg-white px-4 py-3"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Quick actions</h2>
          <Link
            href="/dashboard/hrm/payroll/employees"
            className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
          >
            Directory <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.name}
                href={a.href}
                className="group rounded-xl border border-zinc-200 bg-white px-3 py-2.5 transition-colors hover:border-zinc-300 active:scale-[0.97]"
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden className={`inline-flex h-2 w-2 rounded-full ${a.dot}`} />
                  <Icon className="h-3.5 w-3.5 text-zinc-500" />
                </div>
                <p className="mt-1.5 text-[12px] font-semibold text-zinc-900">{a.name}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Calendar (next-up) preview */}
      <section
        aria-label="Calendar shortcut"
        className="rounded-2xl border border-zinc-200 bg-white px-4 py-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900">People calendar</h2>
          </div>
          <Link
            href="/dashboard/hrm/payroll/holidays"
            className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
          >
            Open <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          Avg onboarding completion is {onboardingKpis.avgCompletionDays} day{onboardingKpis.avgCompletionDays === 1 ? '' : 's'}.
        </p>
      </section>
    </div>
  );
}
