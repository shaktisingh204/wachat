'use client';

import React, { useState, useTransition } from 'react';
import { Card, Badge, Button } from '@/components/zoruui';
import {
  Users,
  CalendarHeart,
  Briefcase,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Building,
  Target,
  ArrowUpRight,
  ChevronRight,
  UserCheck,
  UserX,
  FileText,
  UserPlus,
  Activity,
  Heart
} from 'lucide-react';
import Link from 'next/link';
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

export function HrmAdminDashboardClient({
  activeEmployeesCount,
  totalEmployeesCount,
  todayAttendanceRate,
  pendingLeavesCount,
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

  const handleLeaveAction = async (id: string, action: 'Approved' | 'Rejected') => {
    startTransition(async () => {
      try {
        const res = await approveOrRejectLeave(id, action);
        if (res.success) {
          toast({
            title: `Request ${action}`,
            description: `The leave request has been successfully ${action.toLowerCase()}.`,
          });
          // Update client list
          setLeavesList(prev => prev.filter(l => l._id !== id));
        } else {
          toast({
            title: 'Action Failed',
            description: res.error || 'Failed to update leave request status.',
            variant: 'destructive',
          });
        }
      } catch (err: any) {
        toast({
          title: 'Error',
          description: err.message || 'An unexpected error occurred.',
          variant: 'destructive',
        });
      }
    });
  };

  const getLeaveBadgeTone = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('sick') || t.includes('sl')) return 'danger';
    if (t.includes('casual') || t.includes('cl')) return 'warning';
    if (t.includes('earned') || t.includes('el')) return 'info';
    return 'neutral';
  };

  const getAttendanceStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'present') return <Badge tone="success" className="font-semibold">Present</Badge>;
    if (s === 'wfh') return <Badge tone="info" className="font-semibold">WFH</Badge>;
    if (s === 'late') return <Badge tone="warning" className="font-semibold">Late</Badge>;
    if (s === 'absent') return <Badge tone="danger" className="font-semibold">Absent</Badge>;
    return <Badge tone="neutral" className="font-semibold capitalize">{status}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-10">
      
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-7 rounded-3xl border border-zoru-line shadow-[var(--zoru-shadow-sm)] relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-zoru-ink flex items-center gap-2">
            HRM Executive Console
            <span className="text-[12px] font-bold py-1 px-2.5 rounded-full bg-zoru-brand/20 text-zoru-brand border border-zoru-brand/35 tracking-wider uppercase">
              Admin Portal
            </span>
          </h1>
          <p className="text-zoru-ink-muted text-[14px] mt-1.5 font-medium">
            Welcome back, {userName || 'Administrator'}. Here is your operations overview for today.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 relative z-10">
          <Link href="/dashboard/hrm/payroll/employees/new">
            <Button className="h-10 text-[13px] font-bold shadow-lg hover:shadow-zoru-brand/20 bg-gradient-to-r from-zoru-brand to-zoru-ink border-0 text-white rounded-xl flex items-center gap-1.5 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]">
              <UserPlus className="w-4 h-4" /> Add Employee
            </Button>
          </Link>
          <Link href="/dashboard/hrm/payroll">
            <Button variant="outline" className="h-10 text-[13px] font-bold border-zoru-line bg-zoru-surface-2/60 hover:bg-zoru-surface hover:text-zoru-ink text-zoru-ink rounded-xl flex items-center gap-1.5 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]">
              <Activity className="w-4 h-4 text-zoru-ink" /> Run Payroll
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric: Headcount */}
        <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:border-zoru-line hover:shadow-[var(--zoru-shadow-md)] p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between min-h-[140px] group relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted">Total Headcount</p>
              <h3 className="text-3xl font-extrabold text-zoru-ink mt-1.5 tracking-tight font-mono">{totalEmployeesCount}</h3>
            </div>
            <div className="p-3 rounded-xl bg-zoru-surface-2 text-zoru-ink border border-zoru-line group-hover:scale-110 transition-transform duration-300">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zoru-line flex items-center justify-between text-[12px]">
            <span className="text-zoru-ink-muted font-medium">Active Members</span>
            <span className="text-zoru-ink font-bold font-mono">{activeEmployeesCount}</span>
          </div>
        </Card>
 
        {/* Metric: Attendance Rate */}
        <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:border-zoru-line hover:shadow-[var(--zoru-shadow-md)] p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between min-h-[140px] group relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted">Today's Attendance</p>
              <h3 className="text-3xl font-extrabold text-zoru-ink mt-1.5 tracking-tight font-mono">{todayAttendanceRate}%</h3>
            </div>
            <div className="p-3 rounded-xl bg-zoru-surface-2 text-zoru-ink border border-zoru-line group-hover:scale-110 transition-transform duration-300">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zoru-line flex items-center justify-between text-[12px]">
            <span className="text-zoru-ink-muted font-medium">Status</span>
            <span className="text-zoru-ink font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-zoru-ink animate-ping" /> Live
            </span>
          </div>
        </Card>
 
        {/* Metric: Pending Leaves */}
        <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:border-zoru-line hover:shadow-[var(--zoru-shadow-md)] p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between min-h-[140px] group relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted">Pending Leaves</p>
              <h3 className="text-3xl font-extrabold text-zoru-ink mt-1.5 tracking-tight font-mono">{leavesList.length}</h3>
            </div>
            <div className="p-3 rounded-xl bg-zoru-surface-2 text-zoru-ink border border-zoru-line group-hover:scale-110 transition-transform duration-300">
              <CalendarHeart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zoru-line flex items-center justify-between text-[12px]">
            <span className="text-zoru-ink-muted font-medium">Requires Action</span>
            <span className={`font-bold ${leavesList.length > 0 ? 'text-zoru-ink animate-pulse' : 'text-zoru-ink-muted'}`}>
              {leavesList.length > 0 ? 'Action Needed' : 'All Clear'}
            </span>
          </div>
        </Card>
 
        {/* Metric: Active Job Postings */}
        <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:border-zoru-line hover:shadow-[var(--zoru-shadow-md)] p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between min-h-[140px] group relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted">Active Jobs</p>
              <h3 className="text-3xl font-extrabold text-zoru-ink mt-1.5 tracking-tight font-mono">{activeJobsCount}</h3>
            </div>
            <div className="p-3 rounded-xl bg-zoru-surface-2 text-zoru-ink border border-zoru-line group-hover:scale-110 transition-transform duration-300">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-zoru-line flex items-center justify-between text-[12px]">
            <span className="text-zoru-ink-muted font-medium">Hiring Channels</span>
            <span className="text-zoru-ink font-bold font-mono">Active</span>
          </div>
        </Card>
 
      </div>

      {/* Main Double Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Center Columns: Approvals and Attendance */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Leave Approvals Card */}
          <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] p-5 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zoru-line">
              <h3 className="text-[15px] font-extrabold tracking-tight text-zoru-ink flex items-center gap-2">
                <CalendarHeart className="w-4 h-4 text-zoru-ink" /> Pending Leave Approvals
              </h3>
              <Badge tone={leavesList.length > 0 ? 'danger' : 'neutral'} className="font-mono">{leavesList.length}</Badge>
            </div>

            <div className="pt-4 flex-1">
              {leavesList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-zoru-surface-2 flex items-center justify-center text-zoru-ink mb-3 border border-zoru-line">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-zoru-ink">Inbox zero on leaves</h3>
                  <p className="text-[12px] text-zoru-ink-muted mt-1 max-w-[220px]">No pending requests right now — your team is sorted.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leavesList.map(leave => (
                    <div 
                      key={leave._id} 
                      className="p-4 rounded-xl border border-zoru-line bg-zoru-surface-2/30 hover:border-zoru-line-strong hover:bg-zoru-surface-2/50 transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zoru-ink to-zoru-ink border border-zoru-line flex items-center justify-center text-zoru-ink text-sm font-bold shrink-0 overflow-hidden">
                          {leave.employeeImage ? (
                            <img src={leave.employeeImage} alt={leave.employeeName} className="w-full h-full object-cover" />
                          ) : (
                            leave.employeeName[0]?.toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-bold text-zoru-ink leading-none">{leave.employeeName}</h4>
                            <Badge tone={getLeaveBadgeTone(leave.leaveType)} className="text-[10px] py-0 px-2 uppercase font-mono tracking-wider">
                              {leave.leaveType}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-zoru-ink-muted font-medium mt-1">
                            {leave.designation || 'Team Member'}
                          </p>
                          <p className="text-[12px] text-zoru-ink-muted font-medium flex items-center gap-1.5 mt-2.5">
                            <Clock className="w-3.5 h-3.5 text-zoru-ink" />
                            {leave.startDate ? new Date(leave.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'} 
                            <span className="text-zoru-ink-muted opacity-60">to</span> 
                            {leave.endDate ? new Date(leave.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </p>
                          {leave.reason && (
                            <p className="text-[12px] text-zoru-ink-muted italic bg-zoru-surface-2/20 py-1.5 px-2.5 rounded-lg border border-zoru-line mt-2 font-medium">
                              "{leave.reason}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 w-full md:w-auto shrink-0 md:justify-end border-t border-zoru-line md:border-0 pt-3 md:pt-0">
                        <Button 
                          onClick={() => handleLeaveAction(leave._id, 'Approved')}
                          disabled={isPending}
                          size="sm"
                          className="flex-1 md:flex-none h-8 text-[11px] font-bold gap-1 bg-zoru-surface-20 hover:bg-zoru-ink text-white hover:scale-[1.02] transition-transform active:scale-[0.98] border-0 rounded-lg"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button 
                          onClick={() => handleLeaveAction(leave._id, 'Rejected')}
                          disabled={isPending}
                          size="sm"
                          variant="outline"
                          className="flex-1 md:flex-none h-8 text-[11px] font-bold gap-1 border-zoru-line bg-zoru-surface-20/5 hover:bg-zoru-surface-2 text-zoru-ink hover:text-zoru-ink-muted hover:scale-[1.02] transition-transform active:scale-[0.98] rounded-lg"
                        >
                          <UserX className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Today's Punch-ins List */}
          <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] p-5 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zoru-line">
              <h3 className="text-[15px] font-extrabold tracking-tight text-zoru-ink flex items-center gap-2">
                <Clock className="w-4 h-4 text-zoru-ink" /> Today's Attendance Logs
              </h3>
              <Link href="/dashboard/hrm/payroll/attendance" className="text-[12px] font-bold text-zoru-brand hover:text-zoru-brand-dark flex items-center gap-0.5 transition-colors">
                View Register <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="pt-4 flex-1">
              {todayAttendanceFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-zoru-ink-muted">
                  <div className="w-12 h-12 rounded-full bg-zoru-surface-2/40 flex items-center justify-center text-zoru-ink-muted mb-3 border border-zoru-line">
                    <Clock className="w-6 h-6 text-zoru-ink-muted" />
                  </div>
                  <p className="text-[13px] font-medium">No clock-ins recorded yet today.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-zoru-line text-zoru-ink-muted bg-zoru-surface-2/30">
                        <th className="px-4 py-3 text-[11px] uppercase font-bold tracking-wider">Employee</th>
                        <th className="px-4 py-3 text-[11px] uppercase font-bold tracking-wider">Status</th>
                        <th className="px-4 py-3 text-[11px] uppercase font-bold tracking-wider text-right">In Time</th>
                        <th className="px-4 py-3 text-[11px] uppercase font-bold tracking-wider text-right">Out Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayAttendanceFeed.map((record, index) => (
                        <tr key={record._id || index} className="border-b border-zoru-line hover:bg-zoru-surface-2/20 transition-colors">
                          <td className="px-4 py-3.5 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zoru-surface-2 text-zoru-ink flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                              {record.image ? (
                                <img src={record.image} alt={record.employeeName} className="w-full h-full object-cover" />
                              ) : (
                                record.employeeName[0]?.toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-zoru-ink leading-none">{record.employeeName}</div>
                              <div className="text-[10px] text-zoru-ink-muted mt-1 font-semibold">{record.designation}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {getAttendanceStatusBadge(record.status)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-medium text-zoru-ink">
                            {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-medium text-zoru-ink">
                            {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
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

        {/* Right Column: Quick Links, Holidays, Operations */}
        <div className="space-y-6">
          
          {/* Employee Lifecycle Workflow */}
          <Card className="bg-gradient-to-b from-zoru-surface/80 to-zoru-surface-2/40 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] p-5 rounded-2xl flex flex-col relative overflow-hidden">
            <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] pointer-events-none">
               <Briefcase className="w-32 h-32" />
            </div>
            <h3 className="text-[15px] font-extrabold tracking-tight text-zoru-ink pb-3 border-b border-zoru-line flex items-center gap-2 mb-5 relative z-10">
              <Target className="w-4 h-4 text-zoru-brand" /> Lifecycle Workflow
            </h3>
            
            <div className="flex flex-col relative z-10 pl-2">
              {/* Step 1 */}
              <div className="relative pl-6 pb-5">
                <div className="absolute left-1.5 top-2 bottom-0 w-px bg-zoru-line"></div>
                <div className="absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-zoru-line-strong bg-white"></div>
                <Link href="/dashboard/hrm/hr/jobs" className="group block -mt-1">
                  <span className="text-[13px] font-bold text-zoru-ink group-hover:text-zoru-brand transition-colors block leading-tight">1. Post a Job</span>
                  <span className="text-[11px] text-zoru-ink-muted mt-1 block">Create openings for new roles</span>
                </Link>
              </div>
              
              {/* Step 2 */}
              <div className="relative pl-6 pb-5">
                <div className="absolute left-1.5 top-2 bottom-0 w-px bg-zoru-line"></div>
                <div className="absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-zoru-line-strong bg-white"></div>
                <Link href="/dashboard/hrm/hr/candidates" className="group block -mt-1">
                  <span className="text-[13px] font-bold text-zoru-ink group-hover:text-zoru-brand transition-colors block leading-tight">2. Review Candidates</span>
                  <span className="text-[11px] text-zoru-ink-muted mt-1 block">Interview and send offers</span>
                </Link>
              </div>

              {/* Step 3 */}
              <div className="relative pl-6 pb-5">
                <div className="absolute left-1.5 top-2 bottom-0 w-px bg-zoru-line"></div>
                <div className="absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-zoru-brand bg-white shadow-[0_0_8px_rgba(0,0,0,0.05)]"></div>
                <Link href="/dashboard/hrm/hr/onboarding" className="group block -mt-1">
                  <span className="text-[13px] font-bold text-zoru-brand group-hover:text-zoru-brand-dark transition-colors block leading-tight">3. Onboard Employee</span>
                  <span className="text-[11px] text-zoru-ink-muted mt-1 block">Add details and assign assets</span>
                </Link>
              </div>

              {/* Step 4 */}
              <div className="relative pl-6">
                <div className="absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-zoru-line-strong bg-white"></div>
                <Link href="/dashboard/hrm/payroll/settings" className="group block -mt-1">
                  <span className="text-[13px] font-bold text-zoru-ink group-hover:text-zoru-brand transition-colors block leading-tight">4. Setup Payroll</span>
                  <span className="text-[11px] text-zoru-ink-muted mt-1 block">Configure salary and taxes</span>
                </Link>
              </div>
            </div>
          </Card>

          {/* Active Jobs */}
          <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] p-5 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zoru-line mb-4">
              <h3 className="text-[15px] font-extrabold tracking-tight text-zoru-ink flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-zoru-ink" /> Active Job Openings
              </h3>
              <Badge tone="info" className="font-mono">{activeJobs.length}</Badge>
            </div>

            {activeJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-zoru-ink-muted text-center">
                <Briefcase className="w-6 h-6 opacity-30 mb-2" />
                <p className="text-[12px] font-medium">No open job postings right now.</p>
                <Link href="/dashboard/hrm/hr/jobs" className="text-[11px] font-bold text-zoru-brand hover:underline mt-2">
                  Create Job Posting
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeJobs.slice(0, 4).map(job => (
                  <div key={job._id} className="p-3 rounded-xl border border-zoru-line bg-zoru-surface-2/30 flex flex-col gap-1.5 hover:border-zoru-line-strong transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-[12.5px] font-bold text-zoru-ink line-clamp-1">{job.title}</h4>
                      <Badge tone={job.status?.toLowerCase() === 'open' ? 'success' : 'neutral'} className="text-[9px] py-0 px-1.5 capitalize font-semibold">
                        {job.status || 'Open'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zoru-ink-muted font-medium">
                      <span className="flex items-center gap-0.5"><Building className="w-3 h-3 text-zoru-ink" /> {job.department || 'General'}</span>
                      {job.location && (
                        <>
                          <span className="opacity-50">•</span>
                          <span>{job.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {activeJobs.length > 4 && (
                  <Link href="/dashboard/hrm/hr/jobs" className="block text-center text-[12px] font-bold text-zoru-brand hover:text-zoru-brand-dark transition-colors pt-2.5 border-t border-zoru-line">
                    View all {activeJobs.length} openings
                  </Link>
                )}
              </div>
            )}
          </Card>

          {/* Upcoming Holidays Card */}
          <Card className="bg-zoru-surface/50 border border-zoru-line text-zoru-ink shadow-[var(--zoru-shadow-sm)] p-5 rounded-2xl flex flex-col">
            <h3 className="text-[15px] font-extrabold tracking-tight text-zoru-ink pb-3 border-b border-zoru-line flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-zoru-ink" /> Upcoming Holidays
            </h3>

            {upcomingHolidays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-zoru-ink-muted text-center">
                <Calendar className="w-6 h-6 opacity-30 mb-2" />
                <p className="text-[12px] font-medium">No upcoming holidays scheduled.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingHolidays.map(holiday => (
                  <div key={holiday._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zoru-surface-2/20 transition-colors border border-transparent hover:border-zoru-line">
                    <div className="shrink-0 w-11 h-11 rounded-xl bg-zoru-surface-2 text-zoru-ink flex flex-col items-center justify-center border border-zoru-line font-medium shadow-md shadow-zoru-line">
                      <span className="text-[9px] uppercase font-bold tracking-widest text-zoru-ink-muted">
                        {new Date(holiday.date).toLocaleString([], { month: 'short' })}
                      </span>
                      <span className="text-[15px] font-extrabold leading-none mt-0.5 font-mono">
                        {new Date(holiday.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-[13px] font-bold text-zoru-ink leading-none">{holiday.name}</h4>
                      <p className="text-[11px] text-zoru-ink-muted capitalize mt-1.5 font-medium">
                        {holiday.holidayType || 'Holiday'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>

      </div>

    </div>
  );
}
