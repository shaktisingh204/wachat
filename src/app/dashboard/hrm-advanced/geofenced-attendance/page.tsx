'use client';

import React from 'react';
import { EntityCrudPage } from '@/components/crm/entity-crud-page';
import { getAttendanceRecords, saveAttendanceRecord, deleteAttendanceRecord } from '@/app/actions/hrm-advanced/geofenced-attendance';
import { AttendanceRecord } from '@/lib/hrm-advanced-types';

export default function Page() {
  return (
    <EntityCrudPage<AttendanceRecord>
      title="Geofenced Attendance"
      description="Track employee check-ins and check-outs"
      entityName="Record"
      fetchFn={getAttendanceRecords}
      saveFn={saveAttendanceRecord}
      deleteFn={deleteAttendanceRecord}
      formFields={[
      { name: 'employeeId', label: 'Employee ID', type: 'text' },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'checkInTime', label: 'Check-In', type: 'text' },
      { name: 'checkOutTime', label: 'Check-Out', type: 'text' },
      { name: 'isGeofenced', label: 'Geofenced', type: 'boolean' },
      { name: 'location', label: 'Location', type: 'text' }
    ]}
      columns={[
      { header: 'Employee', accessorKey: 'employeeId' },
      { header: 'Date', accessorKey: 'date' },
      { header: 'Check-In', accessorKey: 'checkInTime' },
      { header: 'Check-Out', accessorKey: 'checkOutTime' },
      { header: 'Geofenced', accessorKey: 'isGeofenced', render: (val) => val ? 'Yes' : 'No' }
    ]}
      defaultValues={{ isGeofenced: false }}
    />
  );
}
