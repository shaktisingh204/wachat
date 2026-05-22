'use client';

import React from 'react';
import { Card, Badge } from '@/components/zoruui';
import { Briefcase, CheckSquare, Target, ArrowRight, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { EmployeePunchWidget } from './employee-punch-widget';

interface EmployeeDashboardClientProps {
  employee: any;
  attendance: any | null;
  tasks: any[];
  projects: any[];
}

export function EmployeeDashboardClient({
  employee,
  attendance,
  tasks,
  projects
}: EmployeeDashboardClientProps) {
  const greeting = `Welcome back, ${employee.firstName || 'Team Member'}!`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-10">
      {/* Header Profile Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zoru-info-ink to-zoru-brand flex items-center justify-center text-white text-2xl font-bold shadow-md">
            {employee.image ? (
              <img src={employee.image} alt={employee.firstName} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              (employee.firstName?.[0] || 'E').toUpperCase()
            )}
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

      {/* Main Punch Widget */}
      <EmployeePunchWidget employeeId={String(employee._id)} initialAttendance={attendance} />

      {/* Workload Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        
        {/* Active Tasks Panel */}
        <Card className="flex flex-col border border-zoru-line overflow-hidden">
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
                  <Link href={`/dashboard/crm/projects/issues`} key={String(task._id)} className="block group">
                    <div className="p-3 rounded-lg border border-zoru-line bg-zoru-surface hover:border-zoru-info transition-colors">
                      <div className="flex justify-between items-start gap-4">
                        <h4 className="text-[13px] font-semibold text-zoru-ink group-hover:text-zoru-info-ink transition-colors line-clamp-1">{task.title}</h4>
                        <Badge tone={task.priority === 'High' ? 'danger' : task.priority === 'Medium' ? 'warning' : 'neutral'} className="shrink-0 text-[10px]">
                          {task.priority || 'Normal'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-zoru-ink-muted font-medium">
                        <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</span>
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

        {/* Assigned Projects Panel */}
        <Card className="flex flex-col border border-zoru-line overflow-hidden">
          <div className="p-4 border-b border-zoru-line bg-zoru-surface/50 flex items-center justify-between backdrop-blur-sm">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-zoru-ink-muted flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> My Projects
            </h3>
            <Badge tone="success" className="font-mono">{projects.length}</Badge>
          </div>
          
          <div className="p-4 flex-1 bg-zoru-bg">
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-zoru-ink-muted">
                <Briefcase className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-[13px]">You haven't been assigned to any projects yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.slice(0, 5).map(project => (
                  <Link href={`/dashboard/crm/projects/${project._id}`} key={String(project._id)} className="block group">
                    <div className="p-3 rounded-lg border border-zoru-line bg-zoru-surface hover:border-zoru-success transition-colors">
                      <div className="flex justify-between items-start gap-4">
                        <h4 className="text-[13px] font-semibold text-zoru-ink group-hover:text-zoru-success-ink transition-colors line-clamp-1">{project.name}</h4>
                        <Badge tone="success" className="shrink-0 text-[10px]">Active</Badge>
                      </div>
                      {project.description && (
                         <p className="text-[11px] text-zoru-ink-muted line-clamp-1 mt-1">{project.description}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-zoru-line bg-zoru-surface/50 text-center">
            <Link href="/dashboard/crm/projects" className="text-[12px] font-semibold text-zoru-brand hover:text-zoru-brand-dark transition-colors inline-flex items-center gap-1">
              Go to Project Management <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>

      </div>
    </div>
  );
}
