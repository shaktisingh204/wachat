'use client';

import React from 'react';
import { Card, Badge, Button } from '@/components/zoruui';
import { Briefcase, CheckSquare, Target, ArrowRight, UserCheck, CalendarDays, Activity, CalendarHeart, Clock, Plus } from 'lucide-react';
import Link from 'next/link';
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



export function EmployeeDashboardClient({
  employee,
  attendance,
  attendance30d,
  tasks,
  projects,
  recentLeaves,
  upcomingHolidays
}: EmployeeDashboardClientProps) {
  const greeting = `Welcome back, ${employee.firstName || 'Team Member'}!`;

  // --- Analytics Calculations ---
  const presentCount = attendance30d.filter((a) => a.status === 'present' || a.status === 'wfh').length;
  const lateCount = attendance30d.filter((a) => (a.lateByMinutes ?? 0) > 0).length;
  const totalHours = attendance30d.reduce((sum, a) => sum + (a.totalHours ?? 0), 0);
  const avgHours = presentCount > 0 ? (totalHours / presentCount).toFixed(1) : 0;

  // --- Mock Quotas for visualization ---
  const elTotal = 24;
  const clTotal = 12;
  const slTotal = 8;
  
  // Very rough derivation from recent leaves for demonstration
  const usedEl = recentLeaves.filter(l => l.status === 'approved' && l.leaveTypeId.includes('EL')).reduce((sum, l) => sum + l.days, 0) || 4;
  const usedCl = recentLeaves.filter(l => l.status === 'approved' && l.leaveTypeId.includes('CL')).reduce((sum, l) => sum + l.days, 0) || 2;
  const usedSl = recentLeaves.filter(l => l.status === 'approved' && l.leaveTypeId.includes('SL')).reduce((sum, l) => sum + l.days, 0) || 1;

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-10">
      {/* Header Profile Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zoru-info-ink to-zoru-brand flex items-center justify-center text-white text-2xl font-bold shadow-md relative group overflow-hidden">
            {employee.image ? (
              <img src={employee.image} alt={employee.firstName} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
            ) : (
              (employee.firstName?.[0] || 'E').toUpperCase()
            )}
            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zoru-ink">{greeting}</h1>
            <p className="text-[13px] text-zoru-ink-muted font-medium flex items-center gap-2 mt-1">
              <UserCheck className="w-4 h-4 text-zoru-success-ink" /> 
              {employee.designation || 'Team Member'} 
              {employee.departmentId && <span className="opacity-50">•</span>}
              {employee.departmentId && <span>{employee.departmentId}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Main Punch Widget (Hidden for Admins) */}
      {!employee.isAdmin && (
        <EmployeePunchWidget employeeId={String(employee._id)} initialAttendance={attendance} />
      )}

      {/* Advanced Features Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Attendance Analytics */}
        <Card className="p-5 border border-zoru-line flex flex-col justify-between bg-zoru-surface/30">
           <h3 className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-zoru-info-ink" /> 30-Day Attendance
           </h3>
           <div className="grid grid-cols-3 gap-3">
              <div className="bg-zoru-surface border border-zoru-line p-3 rounded-xl text-center shadow-sm">
                <div className="text-[10px] uppercase font-bold text-zoru-ink-muted">Present</div>
                <div className="text-[20px] font-bold text-zoru-success-ink font-mono mt-1">{presentCount}</div>
              </div>
              <div className="bg-zoru-surface border border-zoru-line p-3 rounded-xl text-center shadow-sm">
                <div className="text-[10px] uppercase font-bold text-zoru-ink-muted">Late</div>
                <div className="text-[20px] font-bold text-zoru-warning-ink font-mono mt-1">{lateCount}</div>
              </div>
              <div className="bg-zoru-surface border border-zoru-line p-3 rounded-xl text-center shadow-sm">
                <div className="text-[10px] uppercase font-bold text-zoru-ink-muted">Avg Hrs</div>
                <div className="text-[20px] font-bold text-zoru-info-ink font-mono mt-1">{avgHours}</div>
              </div>
           </div>
        </Card>

        {/* Leave Balances Widget */}
        <Card className="p-5 border border-zoru-line flex flex-col justify-between lg:col-span-2 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted flex items-center gap-2">
                <CalendarHeart className="w-4 h-4 text-zoru-ink-muted" /> Leave Balances
            </h3>
            <Link href="/dashboard/crm/hr-payroll/leave/new">
              <Button size="sm" variant="outline" className="h-7 text-[11px] font-bold gap-1 shadow-sm">
                <Plus className="w-3 h-3" /> Request Time Off
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-4 relative z-10">
            {/* EL */}
            <div>
              <div className="flex justify-between text-[11px] font-bold mb-1.5">
                <span className="text-zoru-ink">Earned (EL)</span>
                <span className="text-zoru-ink-muted">{elTotal - usedEl} / {elTotal}</span>
              </div>
              <div className="h-2 bg-zoru-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-zoru-ink rounded-full transition-all" style={{ width: `${((elTotal - usedEl)/elTotal)*100}%` }} />
              </div>
            </div>
            {/* CL */}
            <div>
              <div className="flex justify-between text-[11px] font-bold mb-1.5">
                <span className="text-zoru-ink">Casual (CL)</span>
                <span className="text-zoru-ink-muted">{clTotal - usedCl} / {clTotal}</span>
              </div>
              <div className="h-2 bg-zoru-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-zoru-ink rounded-full transition-all" style={{ width: `${((clTotal - usedCl)/clTotal)*100}%` }} />
              </div>
            </div>
            {/* SL */}
            <div>
              <div className="flex justify-between text-[11px] font-bold mb-1.5">
                <span className="text-zoru-ink">Sick (SL)</span>
                <span className="text-zoru-ink-muted">{slTotal - usedSl} / {slTotal}</span>
              </div>
              <div className="h-2 bg-zoru-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-zoru-ink rounded-full transition-all" style={{ width: `${((slTotal - usedSl)/slTotal)*100}%` }} />
              </div>
            </div>
          </div>
        </Card>

      </div>

      {/* Workload Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Active Tasks Panel */}
        <Card className="flex flex-col border border-zoru-line overflow-hidden md:col-span-2">
          <div className="p-4 border-b border-zoru-line bg-zoru-surface/50 flex items-center justify-between backdrop-blur-sm">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-zoru-ink-muted flex items-center gap-2">
              <CheckSquare className="w-4 h-4" /> My Active Tasks
            </h3>
            <Badge tone="info" className="font-mono">{tasks.length}</Badge>
          </div>
          
          <div className="p-4 flex-1 bg-zoru-bg">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-zoru-ink-muted">
                <CheckSquare className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-[13px]">No active tasks assigned to you right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 5).map(task => (
                  <Link href={`/dashboard/crm/tasks/${task._id}`} key={String(task._id)} className="block group">
                    <div className="p-3 rounded-lg border border-zoru-line bg-zoru-surface hover:border-zoru-info transition-colors">
                      <div className="flex justify-between items-start gap-4">
                        <h4 className="text-[13px] font-semibold text-zoru-ink group-hover:text-zoru-info-ink transition-colors line-clamp-1">{task.title}</h4>
                        <Badge tone={task.priority === 'High' ? 'danger' : task.priority === 'Medium' ? 'warning' : 'neutral'} className="shrink-0 text-[10px]">
                          {task.priority || 'Normal'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-zoru-ink-muted font-medium">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</span>
                        <span className="opacity-50">•</span>
                        <span>{task.status || 'To-Do'}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-zoru-line bg-zoru-surface/50 text-center">
            <Link href="/dashboard/crm/tasks" className="text-[12px] font-semibold text-zoru-brand hover:text-zoru-brand-dark transition-colors inline-flex items-center gap-1">
              View all tasks <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {/* Assigned Projects Panel */}
          <Card className="flex flex-col border border-zoru-line overflow-hidden flex-1">
            <div className="p-4 border-b border-zoru-line bg-zoru-surface/50 flex items-center justify-between backdrop-blur-sm">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-zoru-ink-muted flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> My Projects
              </h3>
              <Badge tone="success" className="font-mono">{projects.length}</Badge>
            </div>
            
            <div className="p-4 flex-1 bg-zoru-bg">
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-zoru-ink-muted">
                  <Briefcase className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-[13px] text-center">You haven't been assigned to any projects.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.slice(0, 3).map(project => (
                    <Link href={`/dashboard/crm/projects/${project._id}`} key={String(project._id)} className="block group">
                      <div className="p-3 rounded-lg border border-zoru-line bg-zoru-surface hover:border-zoru-success transition-colors">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-[13px] font-semibold text-zoru-ink group-hover:text-zoru-success-ink transition-colors line-clamp-1">{project.name}</h4>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Upcoming Holidays Panel */}
          <Card className="flex flex-col border border-zoru-line overflow-hidden flex-1">
            <div className="p-4 border-b border-zoru-line bg-zoru-surface/50 flex items-center justify-between backdrop-blur-sm">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-zoru-ink-muted flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-zoru-brand" /> Upcoming Holidays
              </h3>
            </div>
            
            <div className="p-4 flex-1 bg-zoru-bg">
              {upcomingHolidays.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-zoru-ink-muted">
                  <CalendarDays className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-[13px] text-center">No upcoming holidays found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingHolidays.map(holiday => (
                    <div key={String(holiday._id)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zoru-surface-2 transition-colors">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zoru-brand/10 text-zoru-brand flex flex-col items-center justify-center border border-zoru-brand/20">
                        <span className="text-[9px] uppercase font-bold tracking-widest">{new Date(holiday.date).toLocaleString('en-US', { month: 'short' })}</span>
                        <span className="text-[14px] font-bold leading-none">{new Date(holiday.date).getDate()}</span>
                      </div>
                      <div>
                        <h4 className="text-[13px] font-bold text-zoru-ink">{holiday.name}</h4>
                        <p className="text-[11px] text-zoru-ink-muted capitalize mt-0.5">{holiday.holidayType || 'Holiday'}</p>
                      </div>
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
