import React, { Suspense } from 'react';
import { getAttendanceRecords } from '@/app/actions/hrm-advanced/geofenced-attendance';
import { GeofencedAttendanceClient } from './client-page';

// Revalidate data on layout/page request or let mutations revalidate
export const dynamic = 'force-dynamic';

async function AttendanceData() {
  const data = await getAttendanceRecords();
  return <GeofencedAttendanceClient initialData={data} />;
}

export default function GeofencedAttendancePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading attendance records...</div>}>
      <AttendanceData />
    </Suspense>
  );
}
