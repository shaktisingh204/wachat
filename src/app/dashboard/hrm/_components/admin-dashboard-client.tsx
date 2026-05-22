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
  Heart,
  BriefcaseIcon
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/20 p-6 rounded-3xl border border-slate-800/80 backdrop-blur-md shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-zoru-brand/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            HRM Executive Console
            <span className="text-[12px] font-bold py-1 px-2.5 rounded-full bg-zoru-brand/20 text-zoru-brand border border-zoru-brand/35 tracking-wider uppercase">
              Admin Portal
            </span>
          </h1>
          <p className="text-slate-400 text-[14px] mt-1.5 font-medium">
            Welcome back, {userName || 'Administrator'}. Here is your operations overview for today.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 relative z-10">
          <Link href="/dashboard/hrm/payroll/employees/new">
            <Button className="h-10 text-[13px] font-bold shadow-lg hover:shadow-zoru-brand/20 bg-gradient-to-r from-zoru-brand to-indigo-600 border-0 text-white rounded-xl flex items-center gap-1.5 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]">
              <UserPlus className="w-4 h-4" /> Add Employee
            </Button>
          </Link>
          <Link href="/dashboard/hrm/payroll">
            <Button variant="outline" className="h-10 text-[13px] font-bold border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:text-white text-slate-300 rounded-xl flex items-center gap-1.5 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]">
              <Activity className="w-4 h-4 text-emerald-400" /> Run Payroll
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric: Headcount */}
        <Card className="bg-slate-900/35 border-slate-800 hover:border-indigo-500/40 backdrop-blur-md p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between min-h-[140px] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors duration-300" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Total Headcount</p>
              <h3 className="text-3xl font-extrabold text-white mt-1.5 tracking-tight font-mono">{totalEmployeesCount}</h3>
            </div>
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[12px]">
            <span className="text-slate-400 font-medium">Active Members</span>
            <span className="text-emerald-400 font-bold font-mono">{activeEmployeesCount}</span>
          </div>
        </Card>

        {/* Metric: Attendance Rate */}
        <Card className="bg-slate-900/35 border-slate-800 hover:border-emerald-500/40 backdrop-blur-md p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between min-h-[140px] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors duration-300" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Today's Attendance</p>
              <h3 className="text-3xl font-extrabold text-white mt-1.5 tracking-tight font-mono">{todayAttendanceRate}%</h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[12px]">
            <span className="text-slate-400 font-medium">Status</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Live
            </span>
          </div>
        </Card>

        {/* Metric: Pending Leaves */}
        <Card className="bg-slate-900/35 border-slate-800 hover:border-rose-500/40 backdrop-blur-md p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between min-h-[140px] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors duration-300" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Pending Leaves</p>
              <h3 className="text-3xl font-extrabold text-white mt-1.5 tracking-tight font-mono">{leavesList.length}</h3>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform duration-300">
              <CalendarHeart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[12px]">
            <span className="text-slate-400 font-medium">Requires Action</span>
            <span className={`font-bold ${leavesList.length > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`}>
              {leavesList.length > 0 ? 'Action Needed' : 'All Clear'}
            </span>
          </div>
        </Card>

        {/* Metric: Active Job Postings */}
        <Card className="bg-slate-900/35 border-slate-800 hover:border-amber-500/40 backdrop-blur-md p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between min-h-[140px] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors duration-300" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Active Jobs</p>
              <h3 className="text-3xl font-extrabold text-white mt-1.5 tracking-tight font-mono">{activeJobsCount}</h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform duration-300">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[12px]">
            <span className="text-slate-400 font-medium">Hiring Channels</span>
            <span className="text-amber-400 font-bold font-mono">Active</span>
          </div>
        </Card>

      </div>

      {/* Main Double Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Center Columns: Approvals and Attendance */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Leave Approvals Card */}
          <Card className="bg-slate-900/35 border-slate-800 backdrop-blur-md p-5 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-[15px] font-extrabold tracking-tight text-white flex items-center gap-2">
                <CalendarHeart className="w-4 h-4 text-rose-400" /> Pending Leave Approvals
              </h3>
              <Badge tone={leavesList.length > 0 ? 'danger' : 'neutral'} className="font-mono">{leavesList.length}</Badge>
            </div>

            <div className="pt-4 flex-1">
              {leavesList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                  <div className="w-12 h-12 rounded-full bg-slate-800/40 flex items-center justify-center text-slate-600 mb-3 border border-slate-800">
                    <CheckCircle className="w-6 h-6 text-slate-500/60" />
                  </div>
                  <p className="text-[13px] font-medium">No pending leave requests to approve.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leavesList.map(leave => (
                    <div 
                      key={leave._id} 
                      className="p-4 rounded-xl border border-slate-800 bg-slate-950/20 hover:border-slate-700/85 hover:bg-slate-900/10 transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-slate-700/50 flex items-center justify-center text-indigo-400 text-sm font-bold shrink-0 overflow-hidden">
                          {leave.employeeImage ? (
                            <img src={leave.employeeImage} alt={leave.employeeName} className="w-full h-full object-cover" />
                          ) : (
                            leave.employeeName[0]?.toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-bold text-white leading-none">{leave.employeeName}</h4>
                            <Badge tone={getLeaveBadgeTone(leave.leaveType)} className="text-[10px] py-0 px-2 uppercase font-mono tracking-wider">
                              {leave.leaveType}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium mt-1">
                            {leave.designation || 'Team Member'}
                          </p>
                          <p className="text-[12px] text-slate-300 font-medium flex items-center gap-1.5 mt-2.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            {leave.startDate ? new Date(leave.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'} 
                            <span className="text-slate-500">to</span> 
                            {leave.endDate ? new Date(leave.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </p>
                          {leave.reason && (
                            <p className="text-[12px] text-slate-400 italic bg-slate-900/40 py-1.5 px-2.5 rounded-lg border border-slate-800/80 mt-2 font-medium">
                              "{leave.reason}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 w-full md:w-auto shrink-0 md:justify-end border-t border-slate-800/80 md:border-0 pt-3 md:pt-0">
                        <Button 
                          onClick={() => handleLeaveAction(leave._id, 'Approved')}
                          disabled={isPending}
                          size="sm"
                          className="flex-1 md:flex-none h-8 text-[11px] font-bold gap-1 bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-[1.02] transition-transform active:scale-[0.98] border-0 rounded-lg"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button 
                          onClick={() => handleLeaveAction(leave._id, 'Rejected')}
                          disabled={isPending}
                          size="sm"
                          variant="outline"
                          className="flex-1 md:flex-none h-8 text-[11px] font-bold gap-1 border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 hover:scale-[1.02] transition-transform active:scale-[0.98] rounded-lg"
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
          <Card className="bg-slate-900/35 border-slate-800 backdrop-blur-md p-5 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-[15px] font-extrabold tracking-tight text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" /> Today's Attendance Logs
              </h3>
              <Link href="/dashboard/hrm/payroll/attendance" className="text-[12px] font-bold text-zoru-brand hover:text-zoru-brand-dark flex items-center gap-0.5 transition-colors">
                View Register <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="pt-4 flex-1">
              {todayAttendanceFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                  <div className="w-12 h-12 rounded-full bg-slate-800/40 flex items-center justify-center text-slate-600 mb-3 border border-slate-800">
                    <Clock className="w-6 h-6 text-slate-500/60" />
                  </div>
                  <p className="text-[13px] font-medium">No clock-ins recorded yet today.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-800/60 text-slate-400 bg-slate-900/20">
                        <th className="px-4 py-3 text-[11px] uppercase font-bold tracking-wider">Employee</th>
                        <th className="px-4 py-3 text-[11px] uppercase font-bold tracking-wider">Status</th>
                        <th className="px-4 py-3 text-[11px] uppercase font-bold tracking-wider text-right">In Time</th>
                        <th className="px-4 py-3 text-[11px] uppercase font-bold tracking-wider text-right">Out Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayAttendanceFeed.map((record, index) => (
                        <tr key={record._id || index} className="border-b border-slate-800/50 hover:bg-slate-900/20 transition-colors">
                          <td className="px-4 py-3.5 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                              {record.image ? (
                                <img src={record.image} alt={record.employeeName} className="w-full h-full object-cover" />
                              ) : (
                                record.employeeName[0]?.toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-white leading-none">{record.employeeName}</div>
                              <div className="text-[10px] text-slate-400 mt-1 font-semibold">{record.designation}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {getAttendanceStatusBadge(record.status)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-medium text-slate-300">
                            {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-medium text-slate-300">
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
          
          {/* Quick Actions Shortcuts */}
          <Card className="bg-slate-900/35 border-slate-800 backdrop-blur-md p-5 rounded-2xl flex flex-col">
            <h3 className="text-[15px] font-extrabold tracking-tight text-white pb-3 border-b border-slate-800 flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-zoru-brand" /> Operation Shortcuts
            </h3>
            
            <div className="grid grid-cols-1 gap-2.5">
              <Link href="/dashboard/hrm/payroll/employees" className="group">
                <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/30 hover:bg-zoru-brand/5 hover:border-zoru-brand/40 flex items-center justify-between transition-all duration-300 group-hover:scale-[1.01]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-zoru-brand/10 group-hover:text-zoru-brand transition-colors duration-300">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[13px] font-bold text-white group-hover:text-zoru-brand transition-colors">Employee Directory</span>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Manage cards, personal details</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-zoru-brand transition-all duration-300 group-hover:translate-x-0.5" />
                </div>
              </Link>

              <Link href="/dashboard/hrm/payroll" className="group">
                <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/30 hover:bg-emerald-500/5 hover:border-emerald-500/40 flex items-center justify-between transition-all duration-300 group-hover:scale-[1.01]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-300 transition-colors duration-300">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[13px] font-bold text-white group-hover:text-emerald-300 transition-colors">Payroll Controls</span>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Run payroll, dispatch payslips</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-300 transition-all duration-300 group-hover:translate-x-0.5" />
                </div>
              </Link>

              <Link href="/dashboard/hrm/hr/okrs" className="group">
                <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/30 hover:bg-amber-500/5 hover:border-amber-500/40 flex items-center justify-between transition-all duration-300 group-hover:scale-[1.01]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/10 group-hover:text-amber-300 transition-colors duration-300">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[13px] font-bold text-white group-hover:text-amber-300 transition-colors">OKRs & Performance</span>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Configure team targets, reviews</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-300 transition-all duration-300 group-hover:translate-x-0.5" />
                </div>
              </Link>

              <Link href="/dashboard/hrm/hr/jobs" className="group">
                <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/30 hover:bg-pink-500/5 hover:border-pink-500/40 flex items-center justify-between transition-all duration-300 group-hover:scale-[1.01]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/10 group-hover:text-pink-300 transition-colors duration-300">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[13px] font-bold text-white group-hover:text-pink-300 transition-colors">Recruitment Pipeline</span>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Job postings, candidate interviews</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-pink-300 transition-all duration-300 group-hover:translate-x-0.5" />
                </div>
              </Link>
            </div>
          </Card>

          {/* Active Jobs */}
          <Card className="bg-slate-900/35 border-slate-800 backdrop-blur-md p-5 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-[15px] font-extrabold tracking-tight text-white flex items-center gap-2">
                <BriefcaseIcon className="w-4 h-4 text-amber-400" /> Active Job Openings
              </h3>
              <Badge tone="info" className="font-mono">{activeJobs.length}</Badge>
            </div>

            {activeJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-center">
                <Briefcase className="w-6 h-6 opacity-30 mb-2" />
                <p className="text-[12px] font-medium">No open job postings right now.</p>
                <Link href="/dashboard/hrm/hr/jobs" className="text-[11px] font-bold text-zoru-brand hover:underline mt-2">
                  Create Job Posting
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeJobs.slice(0, 4).map(job => (
                  <div key={job._id} className="p-3 rounded-xl border border-slate-800 bg-slate-950/20 flex flex-col gap-1.5 hover:border-slate-700/80 transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-[12.5px] font-bold text-white line-clamp-1">{job.title}</h4>
                      <Badge tone={job.status?.toLowerCase() === 'open' ? 'success' : 'neutral'} className="text-[9px] py-0 px-1.5 capitalize font-semibold">
                        {job.status || 'Open'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                      <span className="flex items-center gap-0.5"><Building className="w-3 h-3 text-indigo-400" /> {job.department || 'General'}</span>
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
                  <Link href="/dashboard/hrm/hr/jobs" className="block text-center text-[12px] font-bold text-zoru-brand hover:text-zoru-brand-dark transition-colors pt-2.5 border-t border-slate-800/80">
                    View all {activeJobs.length} openings
                  </Link>
                )}
              </div>
            )}
          </Card>

          {/* Upcoming Holidays Card */}
          <Card className="bg-slate-900/35 border-slate-800 backdrop-blur-md p-5 rounded-2xl flex flex-col">
            <h3 className="text-[15px] font-extrabold tracking-tight text-white pb-3 border-b border-slate-800 flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-purple-400" /> Upcoming Holidays
            </h3>

            {upcomingHolidays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-center">
                <Calendar className="w-6 h-6 opacity-30 mb-2" />
                <p className="text-[12px] font-medium">No upcoming holidays scheduled.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingHolidays.map(holiday => (
                  <div key={holiday._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-900/20 transition-colors border border-transparent hover:border-slate-850">
                    <div className="shrink-0 w-11 h-11 rounded-xl bg-purple-500/10 text-purple-400 flex flex-col items-center justify-center border border-purple-500/20 font-medium shadow-md shadow-purple-500/5">
                      <span className="text-[9px] uppercase font-bold tracking-widest text-purple-300">
                        {new Date(holiday.date).toLocaleString([], { month: 'short' })}
                      </span>
                      <span className="text-[15px] font-extrabold leading-none mt-0.5 font-mono">
                        {new Date(holiday.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-[13px] font-bold text-white leading-none">{holiday.name}</h4>
                      <p className="text-[11px] text-slate-400 capitalize mt-1.5 font-medium">
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
