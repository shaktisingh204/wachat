'use server';

import { hrList, hrSave, hrDelete } from '@/lib/hr-crud';
import { AttendanceRecord, AttendanceRecordSchema } from '@/lib/hrm-advanced-types';
import { revalidatePath } from 'next/cache';

const COLLECTION = 'hrm_attendance_records';

export async function getAttendanceRecords() {
  return await hrList<AttendanceRecord>(COLLECTION);
}

export async function saveAttendanceRecord(payload: Partial<AttendanceRecord>) {
  const parsed = AttendanceRecordSchema.parse(payload);
  const result = await hrSave(COLLECTION, parsed);
  if (result.error) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/geofenced-attendance');
  return result;
}

export async function deleteAttendanceRecord(id: string) {
  const result = await hrDelete(COLLECTION, id);
  if (!result.success) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/geofenced-attendance');
  return result;
}
