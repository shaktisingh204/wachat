import React from 'react';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { EmployeeDashboardClient } from './_components/employee-dashboard-client';
import { redirect } from 'next/navigation';
import { listAttendance } from '@/app/actions/crm/attendance.actions';
import { crmTasksApi } from '@/lib/rust-client/crm-tasks';

export default async function HrmDashboardPage() {
  const session = await getSession();
  if (!session?.user) return redirect('/login');

  const { db } = await connectToDatabase();
  const sessionUserId = new ObjectId(String(session.user._id));

  // Check if the current user is an employee
  const employee = await db.collection('crm_employees').findOne({ employeeUserId: sessionUserId });

  if (!employee) {
    // If they are not an employee (e.g. they are the Admin/Owner),
    // redirect them to the employee directory since they don't have a personal punch-in.
    redirect('/dashboard/hrm/payroll/employees');
  }

  // Get today's attendance record for the punch widget
  const today = new Date().toISOString().slice(0, 10);
  const attendanceRes = await listAttendance({ 
    employeeId: String(employee._id),
    dateFrom: `${today}T00:00:00Z`,
    dateTo: `${today}T23:59:59Z`
  });
  
  // Find the exact record for today
  const todayAttendance = attendanceRes.records.find(r => r.date.startsWith(today)) || null;

  // Get active tasks assigned to the employee
  let activeTasks: any[] = [];
  try {
    const tasksRes = await crmTasksApi.list({ assignedTo: String(sessionUserId), limit: 10 });
    activeTasks = tasksRes.items;
  } catch (e) {
    console.error("Failed to fetch tasks for dashboard", e);
  }

  // Get active projects the employee is a member of
  const projects = await db.collection('projects')
    .find({ 'agents.userId': sessionUserId })
    .limit(10)
    .toArray();

  // Convert Mongo IDs to strings
  const serializedEmployee = JSON.parse(JSON.stringify(employee));
  const serializedProjects = JSON.parse(JSON.stringify(projects));

  return (
    <div className="p-6">
      <EmployeeDashboardClient 
        employee={serializedEmployee}
        attendance={todayAttendance}
        tasks={activeTasks}
        projects={serializedProjects}
      />
    </div>
  );
}
