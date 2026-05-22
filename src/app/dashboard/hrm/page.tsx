import React from 'react';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { EmployeeDashboardClient } from './_components/employee-dashboard-client';
import { HrmAdminDashboardClient } from './_components/admin-dashboard-client';
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

  let employee = await db.collection('crm_employees').findOne({ employeeUserId: sessionUserId });
  const isAdmin = !employee || employee.isAdmin === true;

  if (isAdmin) {
    // -------------------------------------------------------------
    // ADMIN / EXECUTIVE PORTAL FLOW
    // -------------------------------------------------------------
    const totalEmployeesCount = await db.collection('crm_employees').countDocuments({ userId: sessionUserId });
    const activeEmployeesCount = await db.collection('crm_employees').countDocuments({ userId: sessionUserId, status: 'Active' });

    // Today's attendance logs
    const todayDate = new Date();
    const startOfDay = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 23, 59, 59, 999);

    const rawAttendanceFeed = await db.collection('crm_attendance').aggregate([
      {
        $match: {
          userId: sessionUserId,
          date: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $lookup: {
          from: 'crm_employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'emp'
        }
      },
      { $unwind: { path: '$emp', preserveNullAndEmptyArrays: true } }
    ]).toArray();

    const todayAttendanceFeed = rawAttendanceFeed.map((record: any) => ({
      _id: String(record._id),
      employeeId: String(record.employeeId),
      employeeName: record.emp ? `${record.emp.firstName} ${record.emp.lastName || ''}`.trim() : 'Unknown Member',
      designation: record.emp?.designation || 'Team Member',
      image: record.emp?.image || null,
      status: record.status || 'Present',
      date: record.date ? new Date(record.date).toISOString() : '',
      checkIn: record.checkIn ? new Date(record.checkIn).toISOString() : undefined,
      checkOut: record.checkOut ? new Date(record.checkOut).toISOString() : undefined,
    }));

    const presentStatuses = ['present', 'wfh', 'late'];
    const presentCount = todayAttendanceFeed.filter((r: any) => 
      r.status && presentStatuses.includes(String(r.status).toLowerCase())
    ).length;
    const todayAttendanceRate = activeEmployeesCount > 0 
      ? Math.round((presentCount / activeEmployeesCount) * 100) 
      : 0;

    // Pending Leave Requests
    const rawPendingLeaves = await db.collection('crm_leave_requests').aggregate([
      {
        $match: {
          userId: sessionUserId,
          status: 'Pending'
        }
      },
      {
        $lookup: {
          from: 'crm_employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'emp'
        }
      },
      { $unwind: { path: '$emp', preserveNullAndEmptyArrays: true } }
    ]).toArray();

    const pendingLeaves = rawPendingLeaves.map((leave: any) => ({
      _id: String(leave._id),
      employeeId: String(leave.employeeId),
      employeeName: leave.emp ? `${leave.emp.firstName} ${leave.emp.lastName || ''}`.trim() : 'Unknown Member',
      employeeImage: leave.emp?.image || null,
      designation: leave.emp?.designation || 'Team Member',
      leaveType: leave.leaveType || 'Casual Leave',
      startDate: leave.startDate ? new Date(leave.startDate).toISOString() : null,
      endDate: leave.endDate ? new Date(leave.endDate).toISOString() : null,
      reason: leave.reason || '',
      status: leave.status || 'Pending',
    }));
    const pendingLeavesCount = pendingLeaves.length;

    // Active Jobs
    const rawJobs = await db.collection('hr_job_postings')
      .find({ userId: sessionUserId })
      .toArray();

    const activeJobs = rawJobs.map((job: any) => ({
      _id: String(job._id),
      title: job.title || 'Untitled Job',
      department: job.department || 'General',
      status: job.status || 'Open',
      location: job.location || undefined,
    }));
    const activeJobsCount = activeJobs.filter((job: any) => job.status?.toLowerCase() === 'open').length;

    // Upcoming Holidays
    const rawHolidays = await db.collection('crm_holidays')
      .find({ userId: sessionUserId })
      .sort({ date: 1 })
      .toArray();
    const nowMidnight = new Date();
    nowMidnight.setHours(0,0,0,0);
    const upcomingHolidays = rawHolidays
      .filter((h: any) => h.date && new Date(h.date).getTime() >= nowMidnight.getTime())
      .slice(0, 5)
      .map((h: any) => ({
        _id: String(h._id),
        name: h.name || 'Holiday',
        date: new Date(h.date).toISOString(),
        holidayType: h.type || 'national',
      }));

    const departmentsCount = await db.collection('crm_departments').countDocuments({ userId: sessionUserId });
    const goalsCount = await db.collection('crm_goals').countDocuments({ userId: sessionUserId });

    return (
      <div className="p-6">
        <HrmAdminDashboardClient
          activeEmployeesCount={activeEmployeesCount}
          totalEmployeesCount={totalEmployeesCount}
          todayAttendanceRate={todayAttendanceRate}
          pendingLeavesCount={pendingLeavesCount}
          activeJobsCount={activeJobsCount}
          pendingLeaves={pendingLeaves}
          todayAttendanceFeed={todayAttendanceFeed}
          activeJobs={activeJobs}
          upcomingHolidays={upcomingHolidays}
          departmentsCount={departmentsCount}
          goalsCount={goalsCount}
          userName={session.user.name || 'Administrator'}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // REGULAR EMPLOYEE PORTAL FLOW
  // -------------------------------------------------------------
  const employeeIdStr = String(employee._id);
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
      limit: 50
    });
    attendance30d = attendanceRes.records || [];
  } catch(e) {
    console.error("Failed to fetch 30d attendance", e);
  }
  
  // Exact record for today
  const todayAttendance = attendance30d.find(r => r.date && r.date.startsWith(today)) || null;

  // Fetch Active Tasks
  let activeTasks: any[] = [];
  try {
    const tasksRes = await crmTasksApi.list({ assignedTo: String(sessionUserId), limit: 10 });
    activeTasks = tasksRes.items;
  } catch (e) {
    console.error("Failed to fetch tasks for dashboard", e);
  }

  // Fetch Active Projects
  let assignedProjectIds: ObjectId[] = [];
  const assignments = await db.collection('crm_project_members')
    .find({ memberUserId: sessionUserId })
    .toArray();
  assignedProjectIds = assignments.map(a => new ObjectId(String(a.projectId)));

  const projectFilter: any = { 
    userId: sessionUserId,
    $or: [
      { visibilityType: 'all' },
      { _id: { $in: assignedProjectIds } }
    ]
  };

  const projects = await db.collection('crm_projects')
    .find(projectFilter)
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  // Fetch Recent Leaves
  let recentLeaves: any[] = [];
  try {
    const leavesRes = await listLeaves({ employeeId: employeeIdStr, limit: 10 });
    recentLeaves = leavesRes.leaves || [];
  } catch(e) {
    console.error("Failed to fetch leaves", e);
  }

  // Fetch Holidays
  let upcomingHolidays: any[] = [];
  try {
    const holidaysRes = await listHolidays({ year: todayDate.getFullYear(), limit: 50 });
    const allHolidays = holidaysRes.holidays || [];
    upcomingHolidays = allHolidays
      .filter(h => new Date(h.date).getTime() >= todayDate.setHours(0,0,0,0))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  } catch(e) {
    console.error("Failed to fetch holidays", e);
  }

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
