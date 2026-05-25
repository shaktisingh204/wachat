import { fmtDate } from '@/lib/utils';
'use client';

import React from 'react';
import { Card, Badge, Button, Progress, Avatar } from '@/components/zoruui';
import {
  Users,
  Briefcase,
  UserPlus,
  Megaphone,
  FileText,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  Heart,
  ShieldCheck,
  CheckCircle,
  Building,
  Bell,
  Calendar,
  Layers,
  Search,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

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

  const getPriorityTone = (priority: string) => {
    const p = priority.toLowerCase();
    if (p === 'urgent') return 'danger';
    if (p === 'high') return 'warning';
    if (p === 'normal') return 'info';
    return 'neutral';
  };

  const getJobStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'open') return <Badge tone="success">Open</Badge>;
    if (s === 'draft') return <Badge tone="neutral">Draft</Badge>;
    if (s === 'on_hold') return <Badge tone="warning">On Hold</Badge>;
    if (s === 'filled') return <Badge tone="info">Filled</Badge>;
    return <Badge tone="neutral" className="capitalize">{status}</Badge>;
  };

  const getOnboardingStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'completed') return <Badge tone="success">Completed</Badge>;
    if (s === 'in_progress') return <Badge tone="info" className="animate-pulse">Active</Badge>;
    if (s === 'pending') return <Badge tone="warning">Pending</Badge>;
    return <Badge tone="neutral" className="capitalize">{status}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-12">
      
      {/* Premium Header Greeting */}
      <div className="relative overflow-hidden bg-zoru-surface/50 p-8 rounded-3xl border border-zoru-line backdrop-blur-md shadow-2xl">
        {/* Glow Spheres */}
        <div className="absolute -top-10 -right-10 w-96 h-96 bg-zoru-brand/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-indigo-500/5  rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-extrabold py-0.5 px-2.5 rounded-full bg-zoru-brand/10 text-zoru-brand border border-zoru-brand/20 tracking-wider uppercase">
                People Operations Hub
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-zoru-ink">
              HR Operations Overview
            </h1>
            <p className="text-zoru-ink-muted text-[14px] mt-2 max-w-xl leading-relaxed">
              Hello {userName || 'Manager'}, welcome to your human resources control console. Manage hiring pipelines, active onboardings, compliance protocols, and corporate updates.
            </p>
          </div>
          
          {/* Quick Action Grid */}
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/hrm/hr/jobs/new">
              <Button className="h-10 text-[12.5px] font-bold shadow-lg hover:shadow-zoru-brand/20 bg-gradient-to-r from-zoru-brand to-indigo-600 border-0 text-white rounded-xl flex items-center gap-1.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
                <Plus className="w-4 h-4" /> Post a Job
              </Button>
            </Link>
            <Link href="/dashboard/hrm/hr/onboarding/new">
              <Button variant="outline" className="h-10 text-[12.5px] font-bold border-zoru-line bg-zoru-surface-2/60 hover:bg-zoru-surface hover:text-zoru-ink text-zoru-ink rounded-xl flex items-center gap-1.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
                <UserPlus className="w-4 h-4 text-emerald-400" /> Onboard Hire
              </Button>
            </Link>
            <Link href="/dashboard/hrm/hr/announcements/new">
              <Button variant="outline" className="h-10 text-[12.5px] font-bold border-zoru-line bg-zoru-surface-2/60 hover:bg-zoru-surface hover:text-zoru-ink text-zoru-ink rounded-xl flex items-center gap-1.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
                <Megaphone className="w-4 h-4 text-amber-400" /> Publish Notice
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric 1: Headcount */}
        <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:border-indigo-500/40 hover:shadow-[var(--zoru-shadow-md)] p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between min-h-[140px] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors duration-300" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted">Total Directory</p>
              <h3 className="text-3xl font-extrabold text-zoru-ink mt-2 tracking-tight font-mono">{totalEmployeesCount}</h3>
            </div>
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zoru-line flex items-center justify-between text-[11.5px]">
            <span className="text-zoru-ink-muted font-medium">Active Staff Count</span>
            <span className="text-emerald-400 font-bold font-mono">{activeEmployeesCount}</span>
          </div>
        </Card>

        {/* Metric 2: Open Jobs */}
        <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:border-emerald-500/40 hover:shadow-[var(--zoru-shadow-md)] p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between min-h-[140px] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors duration-300" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted">Open Channels</p>
              <h3 className="text-3xl font-extrabold text-zoru-ink mt-2 tracking-tight font-mono">
                {jobs.filter(j => j.status?.toLowerCase() === 'open').length}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zoru-line flex items-center justify-between text-[11.5px]">
            <span className="text-zoru-ink-muted font-medium">Active Positions</span>
            <span className="text-zoru-ink font-bold font-mono">{jobs.length} Total</span>
          </div>
        </Card>

        {/* Metric 3: Active Onboardings */}
        <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:border-amber-500/40 hover:shadow-[var(--zoru-shadow-md)] p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between min-h-[140px] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors duration-300" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted">New Hires Onboarding</p>
              <h3 className="text-3xl font-extrabold text-zoru-ink mt-2 tracking-tight font-mono">{onboardingKpis.inProgress}</h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform duration-300">
              <UserPlus className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zoru-line flex items-center justify-between text-[11.5px]">
            <span className="text-zoru-ink-muted font-medium">Completed This Month</span>
            <span className="text-emerald-400 font-bold font-mono">+{onboardingKpis.completedThisMonth}</span>
          </div>
        </Card>

        {/* Metric 4: Policies & Compliance */}
        <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:border-rose-500/40 hover:shadow-[var(--zoru-shadow-md)] p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between min-h-[140px] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors duration-300" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted">Compliance Rate</p>
              <h3 className="text-3xl font-extrabold text-zoru-ink mt-2 tracking-tight font-mono">100%</h3>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform duration-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zoru-line flex items-center justify-between text-[11.5px]">
            <span className="text-zoru-ink-muted font-medium">Active Policy Manuals</span>
            <span className="text-rose-400 font-bold font-mono">{policies.length}</span>
          </div>
        </Card>

      </div>

      {/* Main Content Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Double Column (Onboardings & Careers) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Onboarding Status Panel */}
          <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] p-6 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zoru-line">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                  <UserPlus className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-[15.5px] font-extrabold tracking-tight text-zoru-ink">Active Onboarding Pipeline</h3>
                  <p className="text-[12px] text-zoru-ink-muted mt-0.5">Tracking completion progress for newly recruited staff members.</p>
                </div>
              </div>
              <Link href="/dashboard/hrm/hr/onboarding">
                <Button variant="outline" size="sm" className="h-8 text-[11.5px] border-zoru-line bg-zoru-surface-2/60 text-zoru-ink font-bold rounded-lg hover:bg-zoru-surface hover:text-zoru-ink flex items-center gap-1">
                  View List <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            <div className="pt-5 space-y-4">
              {activeOnboardings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zoru-ink-muted">
                  <div className="w-12 h-12 rounded-full bg-zoru-surface-2/30 border border-zoru-line flex items-center justify-center mb-3">
                    <Heart className="w-6 h-6 text-indigo-400/50" />
                  </div>
                  <p className="text-[13px] font-medium text-zoru-ink-muted">No active onboarding campaigns found.</p>
                  <p className="text-[11.5px] text-zoru-ink-muted mt-1">Initiate a new onboarding workspace to track candidates.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeOnboardings.slice(0, 4).map((onboarding) => {
                    const progress = onboarding.progress ?? 0;
                    return (
                      <div 
                        key={onboarding._id}
                        className="p-4 rounded-xl border border-zoru-line bg-zoru-surface-2/30 hover:border-zoru-line-strong hover:bg-zoru-surface-2/50 transition-all duration-300"
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-zoru-line flex items-center justify-center text-indigo-400 text-sm font-extrabold shadow-inner shrink-0">
                              {onboarding.employeeName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'NH'}
                            </div>
                            <div>
                              <h4 className="text-[13.5px] font-extrabold text-zoru-ink">{onboarding.employeeName || 'New Hire'}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[11.5px] text-zoru-ink-muted flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-zoru-ink-muted" /> 
                                  Joining: {onboarding.joiningDate ? fmtDate(onboarding.joiningDate) : '—'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                            {getOnboardingStatusBadge(onboarding.status)}
                            <Link href={`/dashboard/hrm/hr/onboarding`}>
                              <span className="p-2 rounded-lg bg-zoru-surface-2/40 text-zoru-ink-muted hover:text-zoru-ink border border-zoru-line hover:border-zoru-line-strong transition-all cursor-pointer">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </span>
                            </Link>
                          </div>
                        </div>

                        {/* Progress Indicator */}
                        <div className="mt-4 pt-3 border-t border-zoru-line">
                          <div className="flex justify-between items-center text-[11.5px] mb-1.5">
                            <span className="text-zoru-ink-muted font-medium">Onboarding Milestones Completed</span>
                            <span className="text-indigo-400 font-bold font-mono">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-1.5 bg-zoru-surface-2" indicatorClassName="bg-indigo-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Jobs & Careers Section */}
          <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] p-6 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zoru-line">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                  <Briefcase className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-[15.5px] font-extrabold tracking-tight text-zoru-ink">Active Recruitment Openings</h3>
                  <p className="text-[12px] text-zoru-ink-muted mt-0.5">Postings live on career pages and active recruitment channels.</p>
                </div>
              </div>
              <Link href="/dashboard/hrm/hr/jobs">
                <Button variant="outline" size="sm" className="h-8 text-[11.5px] border-zoru-line bg-zoru-surface-2/60 text-zoru-ink font-bold rounded-lg hover:bg-zoru-surface hover:text-zoru-ink flex items-center gap-1">
                  View Jobs <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            <div className="pt-5">
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zoru-ink-muted">
                  <div className="w-12 h-12 rounded-full bg-zoru-surface-2/30 border border-zoru-line flex items-center justify-center mb-3">
                    <Briefcase className="w-6 h-6 text-emerald-400/50" />
                  </div>
                  <p className="text-[13px] font-medium text-zoru-ink-muted">No active job listings found.</p>
                  <p className="text-[11.5px] text-zoru-ink-muted mt-1">Create hiring post to start receiving candidate applications.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zoru-line">
                  <table className="w-full text-left text-[13px] border-collapse">
                    <thead>
                      <tr className="bg-zoru-surface-2/40 border-b border-zoru-line">
                        <th className="px-4 py-3 text-[11.5px] uppercase font-bold tracking-wider text-zoru-ink-muted">Title</th>
                        <th className="px-4 py-3 text-[11.5px] uppercase font-bold tracking-wider text-zoru-ink-muted">Department</th>
                        <th className="px-4 py-3 text-[11.5px] uppercase font-bold tracking-wider text-zoru-ink-muted">Openings</th>
                        <th className="px-4 py-3 text-[11.5px] uppercase font-bold tracking-wider text-zoru-ink-muted">Type</th>
                        <th className="px-4 py-3 text-center text-[11.5px] uppercase font-bold tracking-wider text-zoru-ink-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.slice(0, 5).map((job) => (
                        <tr 
                          key={job._id}
                          className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/20 transition-colors"
                        >
                          <td className="px-4 py-3.5">
                            <span className="font-extrabold text-zoru-ink">{job.title}</span>
                          </td>
                          <td className="px-4 py-3.5 text-zoru-ink font-medium">
                            {job.departmentName || 'General Operations'}
                          </td>
                          <td className="px-4 py-3.5 text-zoru-ink-muted font-semibold font-mono">
                            {job.filled} / {job.openings} Filled
                          </td>
                          <td className="px-4 py-3.5 text-zoru-ink-muted font-medium capitalize">
                            {job.employmentType?.replace('_', ' ') || 'Full Time'}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {getJobStatusBadge(job.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

        </div>

        {/* Right Single Column (Announcements, Policies & Navigation Guides) */}
        <div className="space-y-6">
          
          {/* Announcements Feed Component */}
          <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] p-6 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zoru-line">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                  <Megaphone className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-[15.5px] font-extrabold tracking-tight text-zoru-ink">Notice Board</h3>
              </div>
              <Link href="/dashboard/hrm/hr/announcements">
                <Button variant="outline" size="sm" className="h-8 text-[11.5px] border-zoru-line bg-zoru-surface-2/60 text-zoru-ink font-bold rounded-lg hover:bg-zoru-surface hover:text-zoru-ink flex items-center gap-0.5">
                  See Feed <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            <div className="pt-5 space-y-4">
              {announcements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-zoru-ink-muted">
                  <div className="w-10 h-10 rounded-full bg-zoru-surface-2/30 border border-zoru-line flex items-center justify-center mb-3 text-zoru-ink-muted">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-[12.5px] font-medium text-zoru-ink-muted">No corporate announcements.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.slice(0, 3).map((ann) => (
                    <div 
                      key={ann._id}
                      className="p-4 rounded-xl border border-zoru-line bg-zoru-surface-2/30 hover:border-zoru-line-strong hover:bg-zoru-surface-2/50 transition-all duration-300 flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <Badge tone={getPriorityTone(ann.priority)} className="uppercase text-[9px] font-extrabold tracking-wide py-0.5 px-2">
                          {ann.priority}
                        </Badge>
                        <span className="text-[10.5px] font-medium text-zoru-ink-muted font-mono">
                          {ann.publishedAt ? fmtDate(ann.publishedAt) : (ann.createdAt ? fmtDate(ann.createdAt) : '')}
                        </span>
                      </div>
                      <h4 className="text-[13.5px] font-extrabold text-zoru-ink mt-2.5 line-clamp-1">{ann.title}</h4>
                      <p className="text-[12px] text-zoru-ink-muted mt-1 line-clamp-2 leading-relaxed">
                        {ann.body?.replace(/<[^>]*>/g, '') || ''}
                      </p>
                      
                      <div className="mt-3 pt-2.5 border-t border-zoru-line flex items-center justify-between text-[11px] text-zoru-ink-muted">
                        <span className="font-semibold text-zoru-ink flex items-center gap-1">
                          <Users className="w-3 h-3 text-zoru-ink-muted" /> Aud: {ann.audience || 'All'}
                        </span>
                        <span className="font-medium text-zoru-ink-muted">By: {ann.authorName || 'Operations'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Compliance & Resource Guide */}
          <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] p-6 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zoru-line">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-[15.5px] font-extrabold tracking-tight text-zoru-ink">HR Policies</h3>
              </div>
              <Link href="/dashboard/hrm/hr/policies">
                <Button variant="outline" size="sm" className="h-8 text-[11.5px] border-zoru-line bg-zoru-surface-2/60 text-zoru-ink font-bold rounded-lg hover:bg-zoru-surface hover:text-zoru-ink flex items-center gap-0.5">
                  Policies <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            <div className="pt-5 space-y-3.5">
              {policies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-zoru-ink-muted">
                  <p className="text-[12.5px] font-medium text-zoru-ink-muted">No active policy documents published.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {policies.slice(0, 4).map((policy) => (
                    <div 
                      key={policy._id}
                      className="p-3 rounded-lg border border-zoru-line bg-zoru-surface-2/30 hover:border-zoru-line-strong transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-zoru-ink-muted shrink-0" />
                        <div className="min-w-0">
                          <h5 className="text-[12.5px] font-bold text-zoru-ink truncate">{policy.name}</h5>
                          <span className="text-[10px] text-zoru-ink-muted font-medium">Cat: {policy.category || 'HR'} · Ver {policy.version || '1.0'}</span>
                        </div>
                      </div>
                      <Link href={`/dashboard/hrm/hr/policies`}>
                        <span className="p-1 rounded bg-zoru-surface-2 text-zoru-ink-muted border border-zoru-line hover:bg-zoru-surface-2 hover:text-zoru-ink cursor-pointer transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

        </div>

      </div>

    </div>
  );
}
