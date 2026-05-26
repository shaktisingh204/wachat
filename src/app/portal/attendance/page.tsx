import { redirect } from 'next/navigation';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import AttendanceClient from './client';
import { listAttendance } from '@/app/actions/crm/attendance.actions';

export const dynamic = 'force-dynamic';

export default async function AttendancePortalPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login?return=/portal/attendance');
  }

  // Fetch the employee ID linked to this user
  const { db } = await connectToDatabase();
  const emp = await db.collection('crm_employees').findOne({
    $or: [
      { userId: session.user._id },
      { userId: session.user._id.toString() }
    ]
  });

  const employeeId = emp ? emp._id.toString() : null;

  // Fetch today's attendance if employee exists
  let todayAttendance = null;
  let error = null;

  if (employeeId) {
    const today = new Date().toISOString().split('T')[0];
    try {
      const res = await listAttendance({
        employeeId,
        dateFrom: today + 'T00:00:00Z',
        dateTo: today + 'T23:59:59Z'
      });
      if (res.records && res.records.length > 0) {
        todayAttendance = res.records[0];
      }
    } catch (e) {
      error = 'Failed to fetch attendance data.';
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-zoru-bg text-zoru-ink">
      <header className="border-b border-zoru-border bg-white px-6 py-4 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold font-heading">Time Tracking Portal</h1>
        <div className="text-sm font-medium flex items-center gap-2">
          {session.user.image && (
            <img src={session.user.image} alt={session.user.name} className="w-8 h-8 rounded-full object-cover" />
          )}
          {session.user.name}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-6 py-12">
        <div className="mx-auto max-w-4xl">
           <AttendanceClient
             employeeId={employeeId}
             todayAttendance={todayAttendance}
           />
           {error && (
             <div className="text-red-500 text-center mt-4 text-sm">{error}</div>
           )}
        </div>
      </main>
    </div>
  );
}
