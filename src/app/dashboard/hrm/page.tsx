import React from 'react';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { EmployeeDashboardClient } from './_components/employee-dashboard-client';
import { redirect } from 'next/navigation';
import { listAttendance } from '@/app/actions/crm/attendance.actions';
import { crmTasksApi } from '@/lib/rust-client/crm-tasks';
import { listLeaves } from '@/app/actions/crm/leaves.actions';
import { listHolidays } from '@/app/actions/crm/holidays.actions';

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

  const employeeIdStr = String(employee._id);

  // 1. Attendance for Today (for Punch Widget) & Last 30 Days (for Analytics)
  const todayDate = new Date();
  const today = todayDate.toISOString().slice(0, 10);
  
  const thirtyDaysAgoDate = new Date(todayDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = thirtyDaysAgoDate.toISOString().slice(0, 10);

  // Fetch last 30 days of attendance
  let attendance30d: any[] = [];
  try {
    const attendanceRes = await listAttendance({ 
      employeeId: employeeIdStr,
      dateFrom: `${thirtyDaysAgo}T00:00:00Z`,
      dateTo: `${today}T23:59:59Z`,
      limit: 50 // generous limit for 30 days
    });
    attendance30d = attendanceRes.records || [];
  } catch(e) {
    console.error("Failed to fetch 30d attendance", e);
  }
  
  // Exact record for today
  const todayAttendance = attendance30d.find(r => r.date && r.date.startsWith(today)) || null;

  // 2. Fetch Active Tasks
  let activeTasks: any[] = [];
  try {
    const tasksRes = await crmTasksApi.list({ assignedTo: String(sessionUserId), limit: 10 });
    activeTasks = tasksRes.items;
  } catch (e) {
    console.error("Failed to fetch tasks for dashboard", e);
  }

  // 3. Fetch Active Projects
  const projects = await db.collection('projects')
    .find({ 'agents.userId': sessionUserId })
    .limit(10)
    .toArray();

  // 4. Fetch Recent Leaves (for Leave Widget)
  let recentLeaves: any[] = [];
  try {
    const leavesRes = await listLeaves({ employeeId: employeeIdStr, limit: 10 });
    recentLeaves = leavesRes.leaves || [];
  } catch(e) {
    console.error("Failed to fetch leaves", e);
  }

  // 5. Fetch Holidays for current year, filter for upcoming
  let upcomingHolidays: any[] = [];
  try {
    const holidaysRes = await listHolidays({ year: todayDate.getFullYear(), limit: 50 });
    const allHolidays = holidaysRes.holidays || [];
    // filter upcoming and sort by date
    upcomingHolidays = allHolidays
      .filter(h => new Date(h.date).getTime() >= todayDate.setHours(0,0,0,0))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5); // take next 5
  } catch(e) {
    console.error("Failed to fetch holidays", e);
  }

  // Convert Mongo IDs to strings
  const serializedEmployee = JSON.parse(JSON.stringify(employee));
  const serializedProjects = JSON.parse(JSON.stringify(projects));

  return (
    <div className="p-6">
      <EmployeeDashboardClient 
        employee={serializedEmployee}
        attendance={todayAttendance}
        attendance30d={attendance30d}
        tasks={activeTasks}
        projects={serializedProjects}
        recentLeaves={recentLeaves}
        upcomingHolidays={upcomingHolidays}
      />
    </div>
  );
}
